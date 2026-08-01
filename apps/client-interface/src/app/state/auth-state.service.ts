import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { AuthenticationService } from '../authentication.service';
import {
  LoginRequest,
  ProfileDto,
  API_BASE_URL,
} from '@optimistic-tanuki/ui-models';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';

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

    this.tokenSubject = new BehaviorSubject<string | null>(null);
    this.isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
    this.decodedTokenSubject = new BehaviorSubject<UserData | null>(null);
    this.currentProfileSubject = new BehaviorSubject<ProfileDto | null>(
      this.getPersistedSelectedProfile()
    );
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
  ): Promise<{ data: Record<string, never> }> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.reject('Login is not available on this platform.');
    }
    const response = await this.authService.login(loginRequest);
    await this.restoreSession();
    return response;
  }

  async restoreSession(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      const response = await this.authService.currentSession();
      const user = response.data.user as UserData;
      this.tokenSubject.next(null);
      this.isAuthenticatedSubject.next(true);
      this.decodedTokenSubject.next(user);
      this._isAuthenticated = true;
    } catch {
      this.tokenSubject.next(null);
      this.isAuthenticatedSubject.next(false);
      this.decodedTokenSubject.next(null);
      this._isAuthenticated = false;
    }
  }

  async restoreSession(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }

    try {
      const response = await firstValueFrom(
        this.http.get<{ data: UserData }>(
          `${this.apiBaseUrl}/authentication/session`,
          { withCredentials: true }
        )
      );
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
    localStorage.removeItem(this.tokenKey);
    this.tokenSubject.next(null);
    this.isAuthenticatedSubject.next(true);
    this.decodedTokenSubject.next({ ...user, profileId: user.profileId ?? '' });
    this._isAuthenticated = true;
  }

  setToken(token: string) {
    console.log('setToken called with token:', token);
    if (!isPlatformBrowser(this.platformId)) {
      console.log('setToken called on non-browser platform');
      return;
    }
    localStorage.removeItem(this.tokenKey);
    this.tokenSubject.next(token);
    this.isAuthenticatedSubject.next(true);
    this.decodedTokenSubject.next(null);
    this._isAuthenticated = true;
  }

  logout() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const token = this.getToken();

    this.http
      .post(
        `${this.apiBaseUrl}/authentication/logout`,
        token ? { token } : {},
        { withCredentials: true }
      )
      .subscribe({
        next: () => console.log('Session invalidated on gateway'),
        error: (err) =>
          console.error('Failed to invalidate session on gateway:', err),
      });

    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.profilesKey);
    localStorage.removeItem(this.selectedProfileKey);
    this.tokenSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.decodedTokenSubject.next(null);
    this.currentProfileSubject.next(null);
    this._isAuthenticated = false;
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
    if (profiles) {
      return JSON.parse(profiles) as ProfileDto[];
    }
    return null;
  }

  persistSelectedProfile(profile: ProfileDto | null) {
    if (!isPlatformBrowser(this.platformId)) {
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
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    const profile = localStorage.getItem(this.selectedProfileKey);
    if (profile) {
      return JSON.parse(profile) as ProfileDto;
    }
    return null;
  }
}
