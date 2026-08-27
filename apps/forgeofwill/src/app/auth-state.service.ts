import { Injectable, Inject, PLATFORM_ID, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthenticationService } from './authentication.service';
import { LoginRequest, ProfileDto } from '@optimistic-tanuki/ui-models';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';

export interface UserData {
  userId: string;
  name: string;
  email: string;
  profileId: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthStateService {
  private tokenSubject: BehaviorSubject<string | null>;
  private isAuthenticatedSubject: BehaviorSubject<boolean>;
  private decodedTokenSubject: BehaviorSubject<UserData | null>;
  private readonly initialSessionRestore: Promise<boolean>;
  private guardSessionRetry: Promise<boolean> | undefined;
  private initialSessionRestoreComplete = false;
  private sessionRestoreGeneration = 0;
  private _isAuthenticated = false;
  private readonly namespace = 'fow-client';
  private readonly tokenKey = `${this.namespace}-authToken`;
  private readonly profilesKey = `${this.namespace}-profiles`;
  private readonly selectedProfileKey = `${this.namespace}-selectedProfile`;

  private authService: AuthenticationService = inject(AuthenticationService);
  private http: HttpClient = inject(HttpClient);
  private platformId: object = inject(PLATFORM_ID);

  constructor() {
    this.tokenSubject = new BehaviorSubject<string | null>(null);
    this.isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
    this.decodedTokenSubject = new BehaviorSubject<UserData | null>(null);
    const initialSessionRestore = isPlatformBrowser(this.platformId)
      ? this.restoreSession()
      : Promise.resolve(false);
    this.initialSessionRestore = initialSessionRestore.finally(() => {
      this.initialSessionRestoreComplete = true;
    });
  }

  isAuthenticated$(): Observable<boolean> {
    if (!isPlatformBrowser(this.platformId)) {
      return new BehaviorSubject<boolean>(false).asObservable();
    }
    return this.isAuthenticatedSubject.asObservable();
  }

  decodedToken$(): Observable<UserData | null> {
    if (!isPlatformBrowser(this.platformId)) {
      return new BehaviorSubject<UserData | null>(null).asObservable();
    }
    return this.decodedTokenSubject.asObservable();
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

  async restoreSession(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }

    const restoreGeneration = ++this.sessionRestoreGeneration;

    try {
      const response = await this.authService.currentSession();
      if (restoreGeneration !== this.sessionRestoreGeneration) {
        return this._isAuthenticated;
      }
      this.tokenSubject.next(null);
      this.isAuthenticatedSubject.next(true);
      this.decodedTokenSubject.next(response.data as UserData);
      this._isAuthenticated = true;
      return true;
    } catch {
      if (restoreGeneration !== this.sessionRestoreGeneration) {
        return this._isAuthenticated;
      }
      this.tokenSubject.next(null);
      this.isAuthenticatedSubject.next(false);
      this.decodedTokenSubject.next(null);
      this._isAuthenticated = false;
      return false;
    }
  }

  waitForInitialSessionRestore(): Promise<boolean> {
    return this.initialSessionRestore;
  }

  /**
   * A client-only route can start after SSR's unauthenticated initialization.
   * Coalesce the guards' one browser retry so concurrent guards issue at most
   * one credentialed session request before they redirect.
   */
  restoreSessionAfterInitialFailure(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId) || this._isAuthenticated) {
      return Promise.resolve(this._isAuthenticated);
    }

    return (this.guardSessionRetry ??= this.restoreSession());
  }

  get isInitialSessionRestoreComplete(): boolean {
    return this.initialSessionRestoreComplete;
  }

  setToken(token: string) {
    console.log('setToken called with token:', token);
    if (!isPlatformBrowser(this.platformId)) {
      console.log('setToken called on non-browser platform');
      return;
    }
    ++this.sessionRestoreGeneration;
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
    ++this.sessionRestoreGeneration;
    this.guardSessionRetry = undefined;
    const token = this.getToken();
    this.http
      .post('/api/authentication/logout', token ? { token } : {}, {
        withCredentials: true,
      })
      .subscribe();
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.profilesKey);
    localStorage.removeItem(this.selectedProfileKey);
    this.tokenSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.decodedTokenSubject.next(null);
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
