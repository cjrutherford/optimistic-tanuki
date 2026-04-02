import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import { HttpClient } from '@angular/common/http';
import {
  API_BASE_URL,
  LoginRequest,
  ProfileDto,
} from '@optimistic-tanuki/ui-models';
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
  private readonly tokenKey = `${this.namespace}-authToken`;
  private readonly profilesKey = `${this.namespace}-profiles`;
  private readonly selectedProfileKey = `${this.namespace}-selectedProfile`;

  private readonly authService = inject(AuthenticationService);
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  private tokenSubject: BehaviorSubject<string | null>;
  private isAuthenticatedSubject: BehaviorSubject<boolean>;
  private decodedTokenSubject: BehaviorSubject<UserData | null>;
  private currentProfileSubject: BehaviorSubject<ProfileDto | null>;
  private _isAuthenticated = false;

  readonly isAuthenticated$: Observable<boolean>;
  readonly decodedToken$: Observable<UserData | null>;
  readonly currentProfile$: Observable<ProfileDto | null>;

  constructor() {
    const token = this.isBrowser() ? localStorage.getItem(this.tokenKey) : null;

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

    if (token) {
      this.setToken(token);
    }
  }

  get isAuthenticated(): boolean {
    return this.isBrowser() ? this._isAuthenticated : false;
  }

  login(loginRequest: LoginRequest): Promise<{ data: { newToken: string } }> {
    if (!this.isBrowser()) {
      return Promise.reject('Login is not available on this platform.');
    }

    return this.authService.login(loginRequest).then((response) => {
      this.setToken(response.data.newToken);
      return response;
    });
  }

  setToken(token: string) {
    if (!this.isBrowser()) {
      return;
    }

    localStorage.setItem(this.tokenKey, token);
    this.tokenSubject.next(token);
    this.isAuthenticatedSubject.next(true);
    this.decodedTokenSubject.next(this.getDecodedToken());
    this._isAuthenticated = true;
  }

  logout() {
    if (!this.isBrowser()) {
      return;
    }

    const token = this.getToken();
    if (token) {
      this.http
        .post(`${this.apiBaseUrl}/authentication/logout`, { token })
        .subscribe({ error: () => undefined });
    }

    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.profilesKey);
    localStorage.removeItem(this.selectedProfileKey);
    this.tokenSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.decodedTokenSubject.next(null);
    this.currentProfileSubject.next(null);
    this._isAuthenticated = false;
  }

  getToken(): string | null {
    return this.isBrowser() ? this.tokenSubject.value : null;
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

  private getDecodedToken(): UserData | null {
    if (!this.isBrowser()) {
      return null;
    }

    const token = localStorage.getItem(this.tokenKey);
    if (!token) {
      return null;
    }

    const decoded = jwtDecode<UserData & { profileId?: string }>(token);
    if (decoded.profileId === undefined || decoded.profileId === null) {
      decoded.profileId = '';
    }
    return decoded;
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
