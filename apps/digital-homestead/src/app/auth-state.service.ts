import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { jwtDecode } from 'jwt-decode';
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
  private readonly namespace = 'dh-client';
  private readonly tokenKey = `${this.namespace}-authToken`;

  private http: HttpClient = inject(HttpClient);
  private platformId: object = inject(PLATFORM_ID);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      this.tokenSubject = new BehaviorSubject<string | null>(null);
      this.isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
      this.decodedTokenSubject = new BehaviorSubject<UserData | null>(null);
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

    const token = localStorage.getItem(this.tokenKey);
    if (token) {
      this.setToken(token);
    }
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

  async login(loginRequest: LoginRequest): Promise<{ data: { newToken: string } }> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.reject('Login is not available on this platform.');
    }
    const response = await firstValueFrom(
      this.http.post<{ data: { newToken: string } }>('/api/authentication/login', loginRequest)
    );
    if (response) {
      const token = response.data.newToken;
      this.setToken(token);
    }
    return response;
  }

  setToken(token: string) {
    if (!isPlatformBrowser(this.platformId)) {
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
    this.tokenSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.decodedTokenSubject.next(null);
    this._isAuthenticated = false;
  }

  private getDecodedToken(): UserData | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    const token = localStorage.getItem(this.tokenKey);
    if (!token) return null;
    try {
      const decoded: any = jwtDecode(token);
      decoded.profileId = decoded.profileId ?? '';
      return decoded as UserData;
    } catch {
      return null;
    }
  }

  getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    const subjectValue = this.tokenSubject.value;
    if (!subjectValue) {
      return localStorage.getItem(this.tokenKey);
    }
    return subjectValue;
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
