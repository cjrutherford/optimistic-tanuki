import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { Router } from '@angular/router';
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
} from '@optimistic-tanuki/ui-models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly API_URL = '/api';
  private readonly APP_SCOPE_HEADER = {
    'x-ot-appscope': 'owner-console',
    'X-ot-session-mode': 'cookie',
  };
  private readonly isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private serviceToken: string | null = null;
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  private hasToken(): boolean {
    return isPlatformBrowser(this.platformId)
      ? this.isAuthenticatedSubject.value
      : !!this.serviceToken;
  }

  getToken(): string | null {
    return isPlatformBrowser(this.platformId) ? null : this.serviceToken;
  }

  setToken(token: string): void {
    if (!isPlatformBrowser(this.platformId)) this.serviceToken = token;
    this.isAuthenticatedSubject.next(true);
  }

  login(
    email: string,
    password: string,
    mfa?: string
  ): Observable<AuthResponse> {
    const loginData: LoginRequest = { email, password, mfa };
    return this.http
      .post<AuthResponse>(`${this.API_URL}/authentication/login`, loginData, {
        headers: this.APP_SCOPE_HEADER,
        withCredentials: true,
      })
      .pipe(
        tap((response) => {
          if (response.data?.newToken && !isPlatformBrowser(this.platformId)) {
            this.serviceToken = response.data.newToken;
          }
          this.isAuthenticatedSubject.next(true);
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
    const registerData: RegisterRequest = {
      email,
      fn,
      ln,
      password,
      confirm,
      bio,
    };
    return this.http.post<AuthResponse>(
      `${this.API_URL}/authentication/register`,
      registerData,
      {
        headers: this.APP_SCOPE_HEADER,
        withCredentials: true,
      }
    );
  }

  logout(): void {
    this.http
      .post(
        `${this.API_URL}/authentication/logout`,
        {},
        {
          headers: this.APP_SCOPE_HEADER,
          withCredentials: true,
        }
      )
      .subscribe({ error: () => undefined });
    this.serviceToken = null;
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/login']);
  }

  restoreSession(): Observable<boolean> {
    if (!isPlatformBrowser(this.platformId)) return of(false);
    return this.http
      .get<{ data: { user: unknown } }>(
        `${this.API_URL}/authentication/session`,
        { headers: this.APP_SCOPE_HEADER, withCredentials: true }
      )
      .pipe(
        tap(() => this.isAuthenticatedSubject.next(true)),
        map(() => true),
        catchError(() => {
          this.isAuthenticatedSubject.next(false);
          return of(false);
        })
      );
  }

  isAuthenticated(): boolean {
    return this.hasToken();
  }
}
