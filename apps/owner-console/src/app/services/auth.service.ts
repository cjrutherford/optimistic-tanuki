import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import LoginRequest from '@optimistic-tanuki/ui-models';
import RegisterRequest from '@optimistic-tanuki/ui-models';
import { AuthResponse } from '@optimistic-tanuki/ui-models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly API_URL = '/api';
  private readonly TOKEN_KEY = 'auth_token';
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  private hasToken(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    return !!localStorage.getItem(this.TOKEN_KEY);
  }

  getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    return localStorage.getItem(this.TOKEN_KEY);
  }

  login(email: string, password: string, mfa?: string): Observable<AuthResponse> {
    const loginData: LoginRequest = { email, password, mfa };
    return this.http.post<AuthResponse>(`${this.API_URL}/authentication/login`, loginData).pipe(
      tap((response) => {
        if (response.data?.newToken && isPlatformBrowser(this.platformId)) {
          localStorage.setItem(this.TOKEN_KEY, response.data.newToken);
          this.isAuthenticatedSubject.next(true);
        }
      })
    );
  }

  register(
    email: string,
    fn: string,
    ln: string,
    password: string,
    confirm: string,
    bio?: string
  ): Observable<AuthResponse> {
    const registerData: RegisterRequest = { email, fn, ln, password, confirm, bio };
    return this.http.post<AuthResponse>(`${this.API_URL}/authentication/register`, registerData).pipe(
      tap((response) => {
        if (response.data?.newToken && isPlatformBrowser(this.platformId)) {
          localStorage.setItem(this.TOKEN_KEY, response.data.newToken);
          this.isAuthenticatedSubject.next(true);
        }
      })
    );
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.TOKEN_KEY);
    }
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return this.hasToken();
  }
}
