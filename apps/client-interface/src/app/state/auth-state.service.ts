import { DestroyRef, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { AuthenticationService } from '../authentication.service';
import {
  LoginRequest,
  ProfileDto,
  API_BASE_URL,
} from '@optimistic-tanuki/ui-models';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import {
  clearOwnedBrowserSessionKeys,
  notifyBrowserSessionReset,
  watchBrowserSessionBoundary,
  publishBrowserSessionBoundary,
  SessionGeneration,
  setPerformanceMonitoringEligibility,
} from '@optimistic-tanuki/common-ui';

export interface UserData {
  userId: string;
  name: string;
  email: string;
  profileId?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthStateService {
  private tokenSubject: BehaviorSubject<string | null>;
  private isAuthenticatedSubject: BehaviorSubject<boolean>;
  private decodedTokenSubject: BehaviorSubject<UserData | null>;
  private currentProfileSubject: BehaviorSubject<ProfileDto | null>;
  private _isAuthenticated = false;
  private readonly namespace = 'ot-client';
  private readonly tokenKey = `${this.namespace}-authToken`;
  private readonly profilesKey = `${this.namespace}-profiles`;
  private readonly selectedProfileKey = `${this.namespace}-selectedProfile`;

  isAuthenticated$: Observable<boolean>;
  decodedToken$: Observable<UserData | null>;
  currentProfile$: Observable<ProfileDto | null>;
  private readonly sessionGeneration = new SessionGeneration();
  private inflightRestore: Promise<boolean> | undefined;

  private authService = inject(AuthenticationService);
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private apiBaseUrl = inject(API_BASE_URL);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      // Initialize with default values if not in a browser environment
      this.tokenSubject = new BehaviorSubject<string | null>(null);
      this.isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
      this.decodedTokenSubject = new BehaviorSubject<UserData | null>(null);
      this.currentProfileSubject = new BehaviorSubject<ProfileDto | null>(null);
      this.isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
      this.decodedToken$ = this.decodedTokenSubject.asObservable();
      this.currentProfile$ = this.currentProfileSubject.asObservable();
      return;
    }

    const stopBoundary = watchBrowserSessionBoundary('client-interface', () => {
      this.sessionGeneration.invalidate();
      this.inflightRestore = undefined;
      this.clearClientSession(false);
    });
    inject(DestroyRef).onDestroy(stopBoundary);
    this.tokenSubject = new BehaviorSubject<string | null>(null);
    this.isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
    this.decodedTokenSubject = new BehaviorSubject<UserData | null>(null);
    this.currentProfileSubject = new BehaviorSubject<ProfileDto | null>(null);
    this.isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
    this.decodedToken$ = this.decodedTokenSubject.asObservable();
    this.currentProfile$ = this.currentProfileSubject.asObservable();

    void this.restoreSession();
  }

  get isAuthenticated(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    return this._isAuthenticated;
  }

  async login(
    loginRequest: LoginRequest
  ): Promise<{ data: Record<string, unknown> }> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.reject('Login is not available on this platform.');
    }
    const generation = this.sessionGeneration.next();
    this.inflightRestore = undefined;
    const response = await this.authService.login(loginRequest);
    if ((response as any)?.data?.guardianConsentPending) return response;
    if (!this.sessionGeneration.isCurrent(generation))
      throw new Error('Sign-in was cancelled.');
    // A pre-login anonymous probe must not satisfy the post-login restore.
    this.sessionGeneration.invalidate();
    this.inflightRestore = undefined;
    if (!(await this.restoreSession())) {
      throw new Error(
        'Sign-in could not restore your session. Please try again.'
      );
    }
    return response;
  }

  restoreSession(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.resolve(false);
    }
    // Coalesce concurrent probes (guards + login/landing racing after
    // hydration) into a single gateway request so one navigation cannot
    // fan out into N session validations.
    if (this.inflightRestore) {
      return this.inflightRestore;
    }

    const restoreGeneration = this.sessionGeneration.next();
    const pending = this.executeRestore(restoreGeneration);
    this.inflightRestore = pending;
    const clearInflight = () => {
      if (this.inflightRestore === pending) {
        this.inflightRestore = undefined;
      }
    };
    pending.then(clearInflight, clearInflight);
    return pending;
  }

  /**
   * Replace the browser session's active profile and verify the new cookie
   * before callers update their selected-profile state. If issuance or
   * verification fails, restore the previously verified profile session.
   */
  async activateProfileSession(profileId: string): Promise<boolean> {
    const currentUser = this.getDecodedTokenValue();
    const previousProfileId = currentUser?.profileId;
    if (!isPlatformBrowser(this.platformId) || !currentUser?.userId) {
      throw new Error('Sign in before switching profiles.');
    }
    if (!profileId || !previousProfileId) {
      throw new Error('A verified profile session is required to switch.');
    }
    if (profileId === previousProfileId) return true;

    const issueProfile = (targetProfileId: string) =>
      firstValueFrom(
        this.http.post(
          `${this.apiBaseUrl}/authentication/issue`,
          { profileId: targetProfileId },
          {
            headers: {
              'X-ot-appscope': 'client-interface',
              'X-ot-session-mode': 'cookie',
            },
            withCredentials: true,
          }
        )
      );
    const invalidatePendingRestore = () => {
      this.sessionGeneration.invalidate();
      this.inflightRestore = undefined;
    };

    invalidatePendingRestore();
    try {
      await issueProfile(profileId);
      invalidatePendingRestore();
      const restored = await this.restoreSessionForProfile(
        currentUser.userId,
        profileId
      );
      const activatedUser = this.getDecodedTokenValue();
      if (
        !restored ||
        activatedUser?.userId !== currentUser.userId ||
        activatedUser.profileId !== profileId
      ) {
        throw new Error('The switched profile session could not be verified.');
      }
      return true;
    } catch {
      // The issue response may have been lost after the server changed its
      // cookie, so always attempt to restore the prior verified profile.
      let rollbackSucceeded = false;
      try {
        invalidatePendingRestore();
        await issueProfile(previousProfileId);
        invalidatePendingRestore();
        const restored = await this.restoreSessionForProfile(
          currentUser.userId,
          previousProfileId
        );
        const rolledBackUser = this.getDecodedTokenValue();
        if (
          !restored ||
          rolledBackUser?.userId !== currentUser.userId ||
          rolledBackUser.profileId !== previousProfileId
        ) {
          throw new Error('The prior session could not be restored.');
        }
        rollbackSucceeded = true;
      } catch {
        // Never leave the app presenting the previous profile while the
        // HttpOnly cookie may authenticate as another profile.
        this.logout();
      }
      throw new Error(
        rollbackSucceeded
          ? 'Profile switching failed. Your previous profile remains active; please try again.'
          : 'Profile switching could not be verified, so your session was ended. Please sign in again.'
      );
    }
  }

  private async executeRestore(restoreGeneration: number): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ data: UserData }>(
          `${this.apiBaseUrl}/authentication/session`,
          { withCredentials: true }
        )
      );
      if (!this.sessionGeneration.isCurrent(restoreGeneration)) {
        return this._isAuthenticated;
      }
      if (!response?.data?.userId)
        throw new Error('Session identity is missing.');
      this.setSession(response.data);
      return true;
    } catch {
      if (!this.sessionGeneration.isCurrent(restoreGeneration)) {
        return this._isAuthenticated;
      }
      this.clearClientSession();
      return false;
    }
  }

  /** Read and validate a switched cookie before publishing its identity. */
  private async restoreSessionForProfile(
    userId: string,
    profileId: string
  ): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) return false;
    const restoreGeneration = this.sessionGeneration.next();
    this.inflightRestore = undefined;
    try {
      const response = await firstValueFrom(
        this.http.get<{ data: UserData }>(
          `${this.apiBaseUrl}/authentication/session`,
          { withCredentials: true }
        )
      );
      if (!this.sessionGeneration.isCurrent(restoreGeneration)) {
        return this._isAuthenticated;
      }
      if (
        response.data?.userId !== userId ||
        response.data?.profileId !== profileId
      ) {
        return false;
      }
      this.setSession(response.data);
      return true;
    } catch {
      return false;
    }
  }

  setSession(user: UserData) {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    // Any externally published identity supersedes pending restores, including
    // the initial anonymous probe where there is no previous user yet.
    this.sessionGeneration.invalidate();
    this.inflightRestore = undefined;
    clearOwnedBrowserSessionKeys(() => localStorage, [this.tokenKey]);
    this.tokenSubject.next(null);
    const saved = this.readStoredProfile<ProfileDto>(this.selectedProfileKey);
    const cached = this.readStoredProfile<ProfileDto[]>(this.profilesKey);
    if (
      (saved && saved.userId !== user.userId) ||
      (cached &&
        (!Array.isArray(cached) ||
          cached.some((p) => p?.userId !== user.userId)))
    ) {
      clearOwnedBrowserSessionKeys(
        () => localStorage,
        [this.selectedProfileKey, this.profilesKey]
      );
    }
    if (this.decodedTokenSubject.value?.userId !== user.userId) {
      clearOwnedBrowserSessionKeys(() => localStorage, ['auth_token']);
      notifyBrowserSessionReset();
      if (this.decodedTokenSubject.value?.userId)
        publishBrowserSessionBoundary('client-interface');
    }
    this._isAuthenticated = true;
    // The session endpoint is protected by the gateway and its token
    // introspection enforces app-scoped age eligibility before returning.
    setPerformanceMonitoringEligibility('client-interface', true);
    this.decodedTokenSubject.next({ ...user, profileId: user.profileId ?? '' });
    this.currentProfileSubject.next(this.getPersistedSelectedProfile());
    this.isAuthenticatedSubject.next(true);
  }

  setToken(token: string) {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.sessionGeneration.invalidate();
    this.inflightRestore = undefined;
    clearOwnedBrowserSessionKeys(() => localStorage, [this.tokenKey]);
    this.tokenSubject.next(token);
    this.isAuthenticatedSubject.next(true);
    this.decodedTokenSubject.next(null);
    this._isAuthenticated = true;
    // A raw token response is not the server-verified session restore.
    setPerformanceMonitoringEligibility('client-interface', false);
  }

  logout() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.sessionGeneration.invalidate();
    this.inflightRestore = undefined;

    const token = this.getToken();

    this.clearClientSession();

    this.http
      .post(
        `${this.apiBaseUrl}/authentication/logout`,
        token ? { token } : {},
        { withCredentials: true }
      )
      .subscribe({
        next: () => console.log('Session invalidated on gateway'),
        error: () => console.error('Session invalidation failed'),
      });
  }

  private clearClientSession(announce = true) {
    notifyBrowserSessionReset();
    if (announce) publishBrowserSessionBoundary('client-interface');
    setPerformanceMonitoringEligibility('client-interface', false);
    clearOwnedBrowserSessionKeys(
      () => localStorage,
      [
        this.tokenKey,
        this.profilesKey,
        this.selectedProfileKey,
        'user', // Retired PresenceService identity cache; never trusted.
        'auth_token', // Retired shared Forum/Notification bearer cache.
      ]
    );
    this._isAuthenticated = false;
    this.tokenSubject.next(null);
    this.decodedTokenSubject.next(null);
    this.currentProfileSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  private readStoredProfile<T>(key: string): T | null {
    try {
      const value = localStorage.getItem(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch {
      clearOwnedBrowserSessionKeys(() => localStorage, [key]);
      return null;
    }
  }

  private getDecodedToken(): UserData | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    return this.decodedTokenSubject.value;
  }

  getToken() {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    return this.tokenSubject.value;
  }

  getDecodedTokenValue() {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    return this.decodedTokenSubject.value;
  }
  persistProfiles(profiles: ProfileDto[] | null) {
    const accountId = this.decodedTokenSubject.value?.userId;
    if (
      profiles &&
      (!this._isAuthenticated ||
        !accountId ||
        profiles.some((profile) => profile.userId !== accountId))
    )
      return;
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (profiles) {
      localStorage.setItem(this.profilesKey, JSON.stringify(profiles));
    } else {
      localStorage.removeItem(this.profilesKey);
    }
  }

  getPersistedProfiles(): ProfileDto[] | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    const userId = this.decodedTokenSubject.value?.userId;
    if (!this._isAuthenticated || !userId) return null;
    const profiles = this.readStoredProfile<ProfileDto[]>(this.profilesKey);
    if (!Array.isArray(profiles)) return null;
    return profiles.filter((p) => p?.userId === userId);
  }

  persistSelectedProfile(profile: ProfileDto | null) {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (profile && profile.userId !== this.decodedTokenSubject.value?.userId)
      return;
    if (profile) {
      localStorage.setItem(this.selectedProfileKey, JSON.stringify(profile));
      this.currentProfileSubject.next(profile);
    } else {
      localStorage.removeItem(this.selectedProfileKey);
      this.currentProfileSubject.next(null);
    }
  }

  getPersistedSelectedProfile(): ProfileDto | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    const userId = this.decodedTokenSubject.value?.userId;
    if (!this._isAuthenticated || !userId) return null;
    const profile = this.readStoredProfile<ProfileDto>(this.selectedProfileKey);
    return profile?.userId === userId ? profile : null;
  }
}
