import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoginRequest, ProfileDto } from '@optimistic-tanuki/ui-models';
import { AuthenticationService } from './authentication.service';

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
  private readonly namespace = 'ot-leads';
  private readonly profilesKey = `${this.namespace}-profiles`;
  private readonly selectedProfileKey = `${this.namespace}-selectedProfile`;

  private readonly authService = inject(AuthenticationService);
  private readonly platformId = inject(PLATFORM_ID);
  private isAuthenticatedSubject: BehaviorSubject<boolean>;
  private decodedTokenSubject: BehaviorSubject<UserData | null>;
  private currentProfileSubject: BehaviorSubject<ProfileDto | null>;
  private _isAuthenticated = false;

  readonly isAuthenticated$: Observable<boolean>;
  readonly decodedToken$: Observable<UserData | null>;
  readonly currentProfile$: Observable<ProfileDto | null>;

  constructor() {
    this.isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
    this.decodedTokenSubject = new BehaviorSubject<UserData | null>(null);
    this.currentProfileSubject = new BehaviorSubject<ProfileDto | null>(
      this.getPersistedSelectedProfile()
    );
    this.isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
    this.decodedToken$ = this.decodedTokenSubject.asObservable();
    this.currentProfile$ = this.currentProfileSubject.asObservable();

    if (this.isBrowser()) void this.restoreSession();
  }

  get isAuthenticated(): boolean {
    return this.isBrowser() ? this._isAuthenticated : false;
  }

  async login(
    loginRequest: LoginRequest
  ): Promise<{ data: Record<string, never> }> {
    if (!this.isBrowser()) {
      return Promise.reject(
        new Error('Login is not available on this platform.')
      );
    }

    const response = await this.authService.login(loginRequest);
    await this.restoreSession();
    return response;
  }

  async restoreSession(): Promise<void> {
    if (!this.isBrowser()) return;
    try {
      const response = await this.authService.currentSession();
      this.isAuthenticatedSubject.next(true);
      this.decodedTokenSubject.next(response.data.user as UserData);
      this._isAuthenticated = true;
    } catch {
      this.isAuthenticatedSubject.next(false);
      this.decodedTokenSubject.next(null);
      this._isAuthenticated = false;
    }
  }

  logout() {
    if (!this.isBrowser()) {
      return;
    }

    this.authService.logout().subscribe({ error: () => undefined });
    localStorage.removeItem(this.profilesKey);
    localStorage.removeItem(this.selectedProfileKey);
    this.isAuthenticatedSubject.next(false);
    this.decodedTokenSubject.next(null);
    this.currentProfileSubject.next(null);
    this._isAuthenticated = false;
  }

  getToken(): string | null {
    return null;
  }

  getDecodedTokenValue(): UserData | null {
    return this.isBrowser() ? this.decodedTokenSubject.value : null;
  }

  persistProfiles(profiles: ProfileDto[] | null) {
    if (!this.isBrowser()) {
      return;
    }

    if (profiles) {
      localStorage.setItem(this.profilesKey, JSON.stringify(profiles));
    } else {
      localStorage.removeItem(this.profilesKey);
    }
  }

  getPersistedProfiles(): ProfileDto[] | null {
    if (!this.isBrowser()) {
      return null;
    }

    const profiles = localStorage.getItem(this.profilesKey);
    return profiles ? (JSON.parse(profiles) as ProfileDto[]) : null;
  }

  persistSelectedProfile(profile: ProfileDto | null) {
    if (!this.isBrowser()) {
      return;
    }

    if (profile) {
      localStorage.setItem(this.selectedProfileKey, JSON.stringify(profile));
      this.currentProfileSubject.next(profile);
    } else {
      localStorage.removeItem(this.selectedProfileKey);
      this.currentProfileSubject.next(null);
    }
  }

  getPersistedSelectedProfile(): ProfileDto | null {
    if (!this.isBrowser()) {
      return null;
    }

    const profile = localStorage.getItem(this.selectedProfileKey);
    return profile ? (JSON.parse(profile) as ProfileDto) : null;
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
