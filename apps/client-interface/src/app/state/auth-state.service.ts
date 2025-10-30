import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthenticationService } from '../authentication.service';
import { LoginRequest, ProfileDto } from '@optimistic-tanuki/ui-models';
import { HttpClient } from '@angular/common/http';
import { jwtDecode } from 'jwt-decode';
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
  private _isAuthenticated = false;
  private readonly namespace = 'ot-client';
  private readonly tokenKey = `${this.namespace}-authToken`;
  private readonly profilesKey = `${this.namespace}-profiles`;
  private readonly selectedProfileKey = `${this.namespace}-selectedProfile`;

  isAuthenticated$: Observable<boolean>;
  decodedToken$: Observable<UserData | null>;

  private authService = inject(AuthenticationService);
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      // Initialize with default values if not in a browser environment
      this.tokenSubject = new BehaviorSubject<string | null>(null);
      this.isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
      this.decodedTokenSubject = new BehaviorSubject<UserData | null>(null);
      this.isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
      this.decodedToken$ = this.decodedTokenSubject.asObservable();
      return;
    }

    this.tokenSubject = new BehaviorSubject<string | null>(
      localStorage.getItem(this.tokenKey)
    );
    this.isAuthenticatedSubject = new BehaviorSubject<boolean>(
      !!localStorage.getItem(this.tokenKey)
    );
    this.decodedTokenSubject = new BehaviorSubject<UserData | null>(
      this.getDecodedToken()
    );
    this.isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
    this.decodedToken$ = this.decodedTokenSubject.asObservable();

    const token = localStorage.getItem(this.tokenKey);
    if (token) {
      this.setToken(token);
    }
  }

  get isAuthenticated(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    return this._isAuthenticated;
  }

  login(loginRequest: LoginRequest): Promise<{ data: { newToken: string } }> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.reject('Login is not available on this platform.');
    }
    return this.authService.login(loginRequest).then((response) => {
      const token = response.data.newToken;
      this.setToken(token);
      return response;
    });
  }

  setToken(token: string) {
    console.log('setToken called with token:', token);
    if (!isPlatformBrowser(this.platformId)) {
      console.log('setToken called on non-browser platform');
      return;
    }
    localStorage.setItem(this.tokenKey, token);
    this.tokenSubject.next(token);
    this.isAuthenticatedSubject.next(true);
    this.decodedTokenSubject.next(this.getDecodedToken());
    this._isAuthenticated = true;
  }

  logout() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.profilesKey);
    localStorage.removeItem(this.selectedProfileKey);
    this.tokenSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.decodedTokenSubject.next(null);
  }

  private getDecodedToken(): UserData | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    const token = localStorage.getItem('authToken');
    if (!token) return null;
    const decoded: any = jwtDecode(token);
    if (decoded.profileId === undefined || decoded.profileId === null)
      decoded.profileId = '';
    return decoded as UserData;
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
    } else {
      localStorage.removeItem(this.selectedProfileKey);
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
