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

export type SessionUser = {
  userId: string;
  profileId?: string;
  email?: string;
  name?: string;
};

export type AuthSessionStatus =
  | 'loading'
  | 'signed-out'
  | 'signed-in'
  | 'expired';

export interface AuthSessionState {
  status: AuthSessionStatus;
  user?: SessionUser;
}

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
  private readonly sessionStateSubject = new BehaviorSubject<AuthSessionState>({
    status: 'loading',
  });
  private serviceToken: string | null = null;
  private sessionUser: SessionUser | null = null;
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  public sessionState$ = this.sessionStateSubject.asObservable();

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

  getSessionUser(): SessionUser | null {
    return this.sessionUser;
  }

  get status(): AuthSessionStatus {
    return this.sessionStateSubject.value.status;
  }

  private setSessionState(state: AuthSessionState): void {
    this.sessionStateSubject.next(state);
    this.isAuthenticatedSubject.next(state.status === 'signed-in');
  }

  setToken(token: string): void {
    if (!isPlatformBrowser(this.platformId)) this.serviceToken = token;
    this.setSessionState({ status: 'signed-in' });
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
          this.setSessionState({ status: 'signed-in' });
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
    this.sessionUser = null;
    this.setSessionState({ status: 'signed-out' });
    this.router.navigate(['/login']);
  }

  restoreSession(): Observable<boolean> {
    if (!isPlatformBrowser(this.platformId)) {
      this.sessionUser = null;
      this.setSessionState({ status: 'signed-out' });
      return of(false);
    }

    const wasSignedIn = this.status === 'signed-in';
    this.setSessionState({ status: 'loading' });

    return this.http
      .get<{ data: SessionUser | { user: SessionUser } }>(
        `${this.API_URL}/authentication/session`,
        {
          headers: this.APP_SCOPE_HEADER,
          withCredentials: true,
        }
      )
      .pipe(
        tap((response) => {
          const data = response.data as SessionUser | { user: SessionUser };
          this.sessionUser = 'user' in data ? data.user : data;
          if (!this.sessionUser?.userId) {
            throw new Error('Session identity is missing');
          }
          this.setSessionState({
            status: 'signed-in',
            user: this.sessionUser,
          });
        }),
        map(() => true),
        catchError(() => {
          this.sessionUser = null;
          this.setSessionState({
            status: wasSignedIn ? 'expired' : 'signed-out',
          });
          return of(false);
        })
      );
  }

  isAuthenticated(): boolean {
    return this.hasToken();
  }
}
