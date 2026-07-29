import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';

export interface UserData {
  userId: string;
  name: string;
  email: string;
  profileId: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthStateService {
  private tokenSubject: BehaviorSubject<string | null>;
  private isAuthenticatedSubject: BehaviorSubject<boolean>;
  private decodedTokenSubject: BehaviorSubject<UserData | null>;
  private _isAuthenticated = false;

  private http: HttpClient = inject(HttpClient);
  private platformId: object = inject(PLATFORM_ID);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      this.tokenSubject = new BehaviorSubject<string | null>(null);
      this.isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
      this.decodedTokenSubject = new BehaviorSubject<UserData | null>(null);
      return;
    }

    this.tokenSubject = new BehaviorSubject<string | null>(null);
    this.isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
    this.decodedTokenSubject = new BehaviorSubject<UserData | null>(null);
    void this.restoreSession();
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
  ): Promise<{ data: { newToken?: string } }> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.reject('Login is not available on this platform.');
    }
    const response = await firstValueFrom(
      this.http.post<{ data: { newToken: string } }>(
        '/api/authentication/login',
        {
          email: loginRequest.username,
          password: loginRequest.password,
        },
        { headers: { 'X-ot-session-mode': 'cookie' }, withCredentials: true }
      )
    );
    if (response.data.newToken) this.setToken(response.data.newToken);
    await this.restoreSession();
    return response;
  }

  async restoreSession(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const response = await firstValueFrom(
        this.http.get<{ data: { user: UserData } }>(
          '/api/authentication/session',
          { withCredentials: true }
        )
      );
      this.tokenSubject.next(null);
      this.isAuthenticatedSubject.next(true);
      this.decodedTokenSubject.next(response.data.user);
      this._isAuthenticated = true;
    } catch {
      this.tokenSubject.next(null);
      this.isAuthenticatedSubject.next(false);
      this.decodedTokenSubject.next(null);
      this._isAuthenticated = false;
    }
  }

  setToken(token: string) {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.tokenSubject.next(token);
    this.isAuthenticatedSubject.next(true);
    this.decodedTokenSubject.next(null);
    this._isAuthenticated = true;
  }

  logout() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.http
      .post('/api/authentication/logout', {}, { withCredentials: true })
      .subscribe({ error: () => undefined });
    this.tokenSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.decodedTokenSubject.next(null);
    this._isAuthenticated = false;
  }

  getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    return this.tokenSubject.value;
  }

  getDecodedTokenValue(): UserData | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    return this.decodedTokenSubject.value;
  }

  getProfileId(): string | null {
    const decoded = this.getDecodedTokenValue();
    return decoded?.profileId || null;
  }
}
