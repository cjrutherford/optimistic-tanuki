import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import {
  API_BASE_URL,
  LoginRequest,
  ProfileDto,
} from '@optimistic-tanuki/ui-models';
import { AuthenticationService } from '../authentication.service';

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
  private readonly namespace = 'fin-commander-auth';
  private readonly tokenKey = `${this.namespace}-authToken`;
  private readonly profilesKey = `${this.namespace}-profiles`;
  private readonly selectedProfileKey = `${this.namespace}-selectedProfile`;

  private readonly authService = inject(AuthenticationService);
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  private readonly tokenSubject: BehaviorSubject<string | null>;
  private readonly isAuthenticatedSubject: BehaviorSubject<boolean>;
  private readonly decodedTokenSubject: BehaviorSubject<UserData | null>;
  private readonly currentProfileSubject: BehaviorSubject<ProfileDto | null>;
  private isAuthenticatedValue = false;

  readonly isAuthenticated$: Observable<boolean>;
  readonly decodedToken$: Observable<UserData | null>;
  readonly currentProfile$: Observable<ProfileDto | null>;

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      this.tokenSubject = new BehaviorSubject<string | null>(null);
      this.isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
      this.decodedTokenSubject = new BehaviorSubject<UserData | null>(null);
      this.currentProfileSubject = new BehaviorSubject<ProfileDto | null>(null);
      this.isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
      this.decodedToken$ = this.decodedTokenSubject.asObservable();
      this.currentProfile$ = this.currentProfileSubject.asObservable();
      return;
    }

    const token = localStorage.getItem(this.tokenKey);
    this.tokenSubject = new BehaviorSubject<string | null>(token);
    this.isAuthenticatedSubject = new BehaviorSubject<boolean>(!!token);
    this.decodedTokenSubject = new BehaviorSubject<UserData | null>(
      this.getDecodedToken()
    );
    this.currentProfileSubject = new BehaviorSubject<ProfileDto | null>(
      this.getPersistedSelectedProfile()
    );
    this.isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
    this.decodedToken$ = this.decodedTokenSubject.asObservable();
    this.currentProfile$ = this.currentProfileSubject.asObservable();
    this.isAuthenticatedValue = !!token;

    if (token) {
      this.setToken(token);
    }
  }

  get isAuthenticated(): boolean {
    return isPlatformBrowser(this.platformId)
      ? this.isAuthenticatedValue
      : false;
  }

  login(loginRequest: LoginRequest): Promise<{ data: { newToken: string } }> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.reject(
        new Error('Login is not available on this platform.')
      );
    }

    return this.authService.login(loginRequest).then((response) => {
      this.setToken(response.data.newToken);
      return response;
    });
  }

  setToken(token: string) {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.setItem(this.tokenKey, token);
    this.tokenSubject.next(token);
    this.isAuthenticatedSubject.next(true);
    this.decodedTokenSubject.next(this.getDecodedToken());
    this.isAuthenticatedValue = true;
    this.authService.setToken(token);
  }

  logout() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const token = this.getToken();
    if (token) {
      this.http
        .post(`${this.apiBaseUrl}/authentication/logout`, { token })
        .subscribe({
          error: () => undefined,
        });
    }

    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.profilesKey);
    localStorage.removeItem(this.selectedProfileKey);
    this.tokenSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.decodedTokenSubject.next(null);
    this.currentProfileSubject.next(null);
    this.isAuthenticatedValue = false;
  }

  getToken() {
    return isPlatformBrowser(this.platformId) ? this.tokenSubject.value : null;
  }

  getDecodedTokenValue() {
    return isPlatformBrowser(this.platformId)
      ? this.decodedTokenSubject.value
      : null;
  }

  persistProfiles(profiles: ProfileDto[] | null) {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (profiles) {
      localStorage.setItem(this.profilesKey, JSON.stringify(profiles));
      return;
    }

    localStorage.removeItem(this.profilesKey);
  }

  getPersistedProfiles(): ProfileDto[] | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const profiles = localStorage.getItem(this.profilesKey);
    return profiles ? (JSON.parse(profiles) as ProfileDto[]) : null;
  }

  persistSelectedProfile(profile: ProfileDto | null) {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (profile) {
      localStorage.setItem(this.selectedProfileKey, JSON.stringify(profile));
      this.currentProfileSubject.next(profile);
      return;
    }

    localStorage.removeItem(this.selectedProfileKey);
    this.currentProfileSubject.next(null);
  }

  getPersistedSelectedProfile(): ProfileDto | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const profile = localStorage.getItem(this.selectedProfileKey);
    return profile ? (JSON.parse(profile) as ProfileDto) : null;
  }

  private getDecodedToken(): UserData | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const token = localStorage.getItem(this.tokenKey);
    if (!token) {
      return null;
    }

    const decoded = jwtDecode<UserData & { profileId?: string | null }>(token);
    return {
      ...decoded,
      profileId: decoded.profileId ?? '',
    };
  }
}
