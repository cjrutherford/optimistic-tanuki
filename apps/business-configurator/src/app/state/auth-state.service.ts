import { Inject, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { normalizeAuthReturnTo } from '@optimistic-tanuki/auth-ui';
import { LoginRequest, ProfileDto } from '@optimistic-tanuki/ui-models';
import { AuthenticationService } from '../services/authentication.service';

export type ConfiguratorAuthStatus =
  | 'signed-out'
  | 'loading'
  | 'signed-in'
  | 'expired';

export interface ConfiguratorAuthRecovery {
  reason: 'expired';
  returnUrl: string | null;
}

export interface UserData {
  userId: string;
  name?: string;
  email?: string;
  profileId: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthStateService {
  private readonly namespace = 'business-configurator';
  private readonly profilesKey = `${this.namespace}-profiles`;
  private readonly selectedProfileKey = `${this.namespace}-selectedProfile`;

  private readonly authService = inject(AuthenticationService);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private readonly statusSubject = new BehaviorSubject<ConfiguratorAuthStatus>(
    'signed-out'
  );
  private readonly decodedTokenSubject = new BehaviorSubject<UserData | null>(
    null
  );
  private recoveryState: ConfiguratorAuthRecovery | null = null;

  private authenticated = false;
  private logoutInProgress = false;

  isAuthenticated$(): Observable<boolean> {
    return this.isAuthenticatedSubject.asObservable();
  }

  get isAuthenticated(): boolean {
    return this.authenticated;
  }

  get status(): ConfiguratorAuthStatus {
    return this.statusSubject.value;
  }

  status$(): Observable<ConfiguratorAuthStatus> {
    return this.statusSubject.asObservable();
  }

  get recovery(): ConfiguratorAuthRecovery | null {
    return this.recoveryState;
  }

  async login(
    loginRequest: LoginRequest
  ): Promise<{ data: Record<string, never> }> {
    const response = await this.authService.login(loginRequest);
    const restored = await this.restoreSession();
    if (!restored) {
      throw new Error('Unable to restore the configurator session');
    }
    return response;
  }

  async restoreSession(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) return false;
    const wasAuthenticated = this.authenticated;
    this.statusSubject.next('loading');
    try {
      const response = await this.authService.currentSession();
      this.isAuthenticatedSubject.next(true);
      this.statusSubject.next('signed-in');
      this.recoveryState = null;
      this.decodedTokenSubject.next({
        userId: response.data.userId,
        name: response.data.name,
        email: response.data.email,
        profileId: '',
      });
      this.authenticated = true;
      return true;
    } catch {
      if (wasAuthenticated) {
        this.setExpiredState(null);
      } else {
        this.setSignedOutState();
      }
      return false;
    }
  }

  logout(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.removeItem(this.profilesKey);
    localStorage.removeItem(this.selectedProfileKey);
    this.setSignedOutState();
    if (this.logoutInProgress) {
      return;
    }

    this.logoutInProgress = true;
    void this.authService
      .logout()
      .catch(() => undefined)
      .finally(() => {
        this.logoutInProgress = false;
      });
  }

  markExpired(returnUrl?: string | null): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.setExpiredState(returnUrl);
    if (this.logoutInProgress) {
      return;
    }

    this.logoutInProgress = true;
    void this.authService
      .logout()
      .catch(() => undefined)
      .finally(() => {
        this.logoutInProgress = false;
      });
  }

  getDecodedTokenValue(): UserData | null {
    return this.decodedTokenSubject.value;
  }

  persistProfiles(profiles: ProfileDto[] | null): void {
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

    const profiles = localStorage.getItem(this.profilesKey);
    return profiles ? (JSON.parse(profiles) as ProfileDto[]) : null;
  }

  persistSelectedProfile(profile: ProfileDto | null): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (profile) {
      localStorage.setItem(this.selectedProfileKey, JSON.stringify(profile));
    } else {
      localStorage.removeItem(this.selectedProfileKey);
    }
  }

  getPersistedSelectedProfile(): ProfileDto | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const profile = localStorage.getItem(this.selectedProfileKey);
    return profile ? (JSON.parse(profile) as ProfileDto) : null;
  }

  private setSignedOutState(): void {
    this.isAuthenticatedSubject.next(false);
    this.statusSubject.next('signed-out');
    this.recoveryState = null;
    this.decodedTokenSubject.next(null);
    this.authenticated = false;
  }

  private setExpiredState(returnUrl: string | null | undefined): void {
    this.isAuthenticatedSubject.next(false);
    this.statusSubject.next('expired');
    this.recoveryState = {
      reason: 'expired',
      returnUrl: this.normalizeReturnUrl(returnUrl),
    };
    this.decodedTokenSubject.next(null);
    this.authenticated = false;
  }

  private normalizeReturnUrl(
    returnUrl: string | null | undefined
  ): string | null {
    const target = normalizeAuthReturnTo(returnUrl, {
      currentOrigin:
        typeof window !== 'undefined' && window.location.origin
          ? window.location.origin
          : 'http://business-configurator.invalid',
    });
    return target?.isCurrentOrigin ? target.path : null;
  }
}
