import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { AuthenticationService } from './authentication.service';
import { LoginRequest } from '@optimistic-tanuki/ui-models';

export interface UserData {
  userId: string;
  name: string;
  email: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthStateService {
  private tokenSubject: BehaviorSubject<string | null>;
  private isAuthenticatedSubject: BehaviorSubject<boolean>;
  private _isAuthenticated = false;
  private readonly namespace = 'ot-local-hub';
  private readonly tokenKey = `${this.namespace}-authToken`;

  isAuthenticated$: Observable<boolean>;

  private authService = inject(AuthenticationService);
  private platformId = inject(PLATFORM_ID);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      this.tokenSubject = new BehaviorSubject<string | null>(null);
      this.isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
      this.isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
      return;
    }

    const storedToken = localStorage.getItem(this.tokenKey);
    this.tokenSubject = new BehaviorSubject<string | null>(storedToken);
    this.isAuthenticatedSubject = new BehaviorSubject<boolean>(!!storedToken);
    this.isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
    this._isAuthenticated = !!storedToken;

    if (storedToken) {
      this.setToken(storedToken);
    }
  }

  get isAuthenticated(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    return this._isAuthenticated;
  }

  getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    return localStorage.getItem(this.tokenKey);
  }

  setToken(token: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    localStorage.setItem(this.tokenKey, token);
    this.tokenSubject.next(token);
    this._isAuthenticated = true;
    this.isAuthenticatedSubject.next(true);
    this.authService.setToken(token);
  }

  async login(email: string, password: string): Promise<void> {
    const request: LoginRequest = { email, password };
    const response = await this.authService.login(request);
    const token = response?.data?.newToken;
    if (token) {
      this.setToken(token);
    }
  }

  logout(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    localStorage.removeItem(this.tokenKey);
    this.tokenSubject.next(null);
    this._isAuthenticated = false;
    this.isAuthenticatedSubject.next(false);
  }
}
