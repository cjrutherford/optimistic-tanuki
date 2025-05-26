import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthenticationService } from '../authentication.service';
import { LoginRequest } from '@optimistic-tanuki/ui-models';
import { HttpClient } from '@angular/common/http';
import { jwtDecode } from 'jwt-decode';
import { isPlatformBrowser } from '@angular/common';

export interface UserData {
  userId: string;
  name: string;
  email: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthStateService {
  private tokenSubject: BehaviorSubject<string | null>;
  private isAuthenticatedSubject: BehaviorSubject<boolean>;
  private decodedTokenSubject: BehaviorSubject<UserData | null>;
  private _isAuthenticated = false;

  isAuthenticated$: Observable<boolean>;
  decodedToken$: Observable<UserData | null>;

  constructor(
    private authService: AuthenticationService,
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    if (!isPlatformBrowser(this.platformId)) {
      // Initialize with default values if not in a browser environment
      this.tokenSubject = new BehaviorSubject<string | null>(null);
      this.isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
      this.decodedTokenSubject = new BehaviorSubject<UserData | null>(null);
      this.isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
      this.decodedToken$ = this.decodedTokenSubject.asObservable();
      return;
    }

    this.tokenSubject = new BehaviorSubject<string | null>(localStorage.getItem('authToken'));
    this.isAuthenticatedSubject = new BehaviorSubject<boolean>(!!localStorage.getItem('authToken'));
    this.decodedTokenSubject = new BehaviorSubject<UserData | null>(this.getDecodedToken());
    this.isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
    this.decodedToken$ = this.decodedTokenSubject.asObservable();

    const token = localStorage.getItem('authToken');
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

  login(loginRequest: LoginRequest): Promise<{data: { newToken: string }}> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.reject('Login is not available on this platform.');
    }
    return this.authService.login(loginRequest).then(response => {
      const token = response.data.newToken;
      this.setToken(token);
      return response;
    });
  }

  setToken(token: string) {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    localStorage.setItem('authToken', token);
    this.tokenSubject.next(token);
    this.isAuthenticatedSubject.next(true);
    this.decodedTokenSubject.next(this.getDecodedToken());
    this._isAuthenticated = true;
  }

  logout() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    localStorage.removeItem('authToken');
    localStorage.removeItem('profiles');
    localStorage.removeItem('selectedProfile');
    this.tokenSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.decodedTokenSubject.next(null);
  }

  private getDecodedToken(): UserData | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    const token = localStorage.getItem('authToken');
    return token ? jwtDecode(token) : null;
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
}
