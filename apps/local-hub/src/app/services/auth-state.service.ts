import { DestroyRef, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { AuthenticationService } from './authentication.service';
import { LoginRequest } from '@optimistic-tanuki/ui-models';
import { HttpClient } from '@angular/common/http';
import {
  SessionGeneration,
  clearOwnedBrowserSessionKeys,
  notifyBrowserSessionReset,
  watchBrowserSessionBoundary,
  publishBrowserSessionBoundary,
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
  private isAuthenticatedSubject: BehaviorSubject<boolean>;
  private userDataSubject: BehaviorSubject<UserData | null>;
  private _isAuthenticated = false;
  private sessionRestorePromise: Promise<void> | null = null;
  private readonly sessionGeneration = new SessionGeneration();

  isAuthenticated$: Observable<boolean>;
  userData$: Observable<UserData | null>;

  private authService = inject(AuthenticationService);
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      this.isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
      this.userDataSubject = new BehaviorSubject<UserData | null>(null);
      this.isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
      this.userData$ = this.userDataSubject.asObservable();
      return;
    }

    this.isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
    this.userDataSubject = new BehaviorSubject<UserData | null>(null);
    this.isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
    this.userData$ = this.userDataSubject.asObservable();
    const stopBoundary = watchBrowserSessionBoundary('local-hub', () => {
      this.sessionGeneration.invalidate();
      this.sessionRestorePromise = Promise.resolve();
      clearOwnedBrowserSessionKeys(
        () => localStorage,
        ['ot-local-hub-authToken', 'auth_token']
      );
      notifyBrowserSessionReset();
      this._isAuthenticated = false;
      setPerformanceMonitoringEligibility('local-hub', false);
      this.isAuthenticatedSubject.next(false);
      this.userDataSubject.next(null);
    });
    inject(DestroyRef).onDestroy(stopBoundary);
    this.sessionRestorePromise = this.restoreSession();
  }

  get isAuthenticated(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    return this._isAuthenticated;
  }

  getUserData(): UserData | null {
    return this.userDataSubject.value;
  }

  getToken(): string | null {
    return null;
  }

  async login(
    credentials: LoginRequest
  ): Promise<'pending' | 'pending-undelivered' | void> {
    const request: LoginRequest = { ...credentials };
    const generation = this.sessionGeneration.next();
    const response = await this.authService.login(request);
    if ((response as any)?.data?.guardianConsentPending) {
      return (response as any)?.data?.guardianEmailSent === true
        ? 'pending'
        : 'pending-undelivered';
    }
    if (!this.sessionGeneration.isCurrent(generation))
      throw new Error('Sign-in was cancelled.');
    await this.restoreSession();
    if (!this.isAuthenticated)
      throw new Error(
        'Sign-in could not restore your session. Please try again.'
      );
  }

  async restoreSession(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const generation = this.sessionGeneration.next();

    try {
      const response = await this.authService.currentSession();
      if (!this.sessionGeneration.isCurrent(generation)) return;
      const sessionData = response?.data as
        | (UserData & { user?: UserData })
        | undefined;
      const user = sessionData?.user ?? sessionData;
      if (!user?.userId) throw new Error('Session identity is missing.');
      if (this.userDataSubject.value?.userId !== user.userId) {
        clearOwnedBrowserSessionKeys(
          () => localStorage,
          ['ot-local-hub-authToken', 'auth_token']
        );
        notifyBrowserSessionReset();
        if (this.userDataSubject.value?.userId)
          publishBrowserSessionBoundary('local-hub');
      }
      this._isAuthenticated = true;
      // The session endpoint is protected by the gateway and its token
      // introspection enforces app-scoped age eligibility before returning.
      setPerformanceMonitoringEligibility('local-hub', true);
      this.isAuthenticatedSubject.next(true);
      this.userDataSubject.next(user as UserData);
    } catch {
      if (!this.sessionGeneration.isCurrent(generation)) return;
      clearOwnedBrowserSessionKeys(
        () => localStorage,
        ['ot-local-hub-authToken', 'auth_token']
      );
      notifyBrowserSessionReset();
      publishBrowserSessionBoundary('local-hub');
      this._isAuthenticated = false;
      setPerformanceMonitoringEligibility('local-hub', false);
      this.isAuthenticatedSubject.next(false);
      this.userDataSubject.next(null);
    }
  }

  /**
   * Wait for the constructor's cookie-session restore to settle. Guards use
   * this shared promise so they never consume the initial `false` value while
   * the browser session request is still in flight.
   */
  waitForSessionRestore(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return Promise.resolve();
    return (this.sessionRestorePromise ??= this.restoreSession());
  }

  /** Returns the caller's profileId, falling back to userId, then empty string. */
  getActingProfileId(): string {
    const data = this.userDataSubject.value;
    return data?.profileId || data?.userId || '';
  }

  logout(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.sessionGeneration.invalidate();
    this.sessionRestorePromise = Promise.resolve();
    setPerformanceMonitoringEligibility('local-hub', false);
    clearOwnedBrowserSessionKeys(
      () => localStorage,
      ['ot-local-hub-authToken', 'auth_token']
    );
    notifyBrowserSessionReset();
    publishBrowserSessionBoundary('local-hub');
    this._isAuthenticated = false;
    this.isAuthenticatedSubject.next(false);
    this.userDataSubject.next(null);
    this.http
      .post('/api/authentication/logout', {}, { withCredentials: true })
      .subscribe({ error: () => undefined });
  }
}
