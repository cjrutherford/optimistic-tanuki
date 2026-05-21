import {
  Injectable,
  PLATFORM_ID,
  inject,
  signal,
  computed,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import { RegisterRequest } from '@optimistic-tanuki/models';

export interface BusinessAuthUser {
  token: string;
  profileId: string;
  userId: string;
  email: string;
  name?: string;
}

const TOKEN_KEY = 'business-site:token';
const USER_KEY = 'business-site:user';
const CLIENT_USER_KEY = 'business-site:client-user';
const CLIENT_TOKEN_KEY = 'business-site:client-token';
const BUSINESS_SITE_SCOPE = 'business-site';

interface TokenClaims {
  userId?: string;
  profileId?: string;
  email?: string;
  name?: string;
}

@Injectable({ providedIn: 'root' })
export class BusinessAuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly _user = signal<BusinessAuthUser | null>(this.loadUser());

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => !!this._user());
  readonly token = computed(() => this._user()?.token ?? null);

  private readonly _clientUser = signal<BusinessAuthUser | null>(this.loadClientUser());

  readonly clientUser = this._clientUser.asReadonly();
  readonly isClientAuthenticated = computed(() => !!this._clientUser());
  readonly clientToken = computed(() => this._clientUser()?.token ?? null);

  private extractToken(response: {
    token?: string;
    newToken?: string;
    data?: { token?: string; newToken?: string };
  } | undefined): string | null {
    return (
      response?.data?.newToken ||
      response?.data?.token ||
      response?.newToken ||
      response?.token ||
      null
    );
  }

  private decodeTokenClaims(token: string): TokenClaims {
    try {
      return jwtDecode<TokenClaims>(token);
    } catch {
      return {};
    }
  }

  private buildClientUser(
    baseToken: string,
    loginResult: { email?: string; userId?: string },
    exchangeResult?: { token?: string; newToken?: string }
  ): BusinessAuthUser {
    const baseClaims = this.decodeTokenClaims(baseToken);
    const exchangeToken = this.extractToken(exchangeResult);
    const exchangeClaims = exchangeToken
      ? this.decodeTokenClaims(exchangeToken)
      : {};

    return {
      token: exchangeToken || baseToken,
      profileId:
        exchangeClaims.profileId ||
        baseClaims.profileId ||
        '',
      userId:
        baseClaims.userId ||
        loginResult.userId ||
        '',
      email: loginResult?.email || baseClaims.email || '',
      name: exchangeClaims.name || baseClaims.name || '',
    };
  }

  private authRequestOptions(baseToken?: string) {
    return {
      headers: {
        'x-ot-appscope': BUSINESS_SITE_SCOPE,
        ...(baseToken ? { Authorization: `Bearer ${baseToken}` } : {}),
      },
    };
  }

  loginClient(email: string, password: string): Observable<BusinessAuthUser> {
    return new Observable<BusinessAuthUser>((observer) => {
      this.http
        .post<{ token: string; userId?: string; email?: string }>(
          '/api/authentication/login',
          { email, password },
          this.authRequestOptions()
        )
        .subscribe({
          next: (loginResult) => {
            const baseToken = this.extractToken(loginResult);
            if (!baseToken) {
              observer.error(new Error('Login did not return a token'));
              return;
            }
            const authUser = this.buildClientUser(baseToken, {
              email: loginResult.email ?? email,
              userId: loginResult.userId,
            });
            this.storeClientUser(authUser);
            observer.next(authUser);
            observer.complete();

            this.http
              .post<{ token: string; profileId: string }>(
                '/api/authentication/exchange',
                { targetAppId: 'business-site' },
                this.authRequestOptions(baseToken)
              )
              .subscribe({
                next: (exchangeResult) => {
                  const exchangedUser = this.buildClientUser(
                    baseToken,
                    {
                      email: loginResult.email ?? email,
                      userId: loginResult.userId,
                    },
                    exchangeResult
                  );
                  if (exchangedUser.token) {
                    this.storeClientUser(exchangedUser);
                  }
                },
                error: () => undefined,
              });
          },
          error: (err) => observer.error(err),
        });
    });
  }

  logoutClient(): void {
    this.clearClientUser();
  }

  registerClient(payload: RegisterRequest): Observable<unknown> {
    return this.http.post(
      '/api/authentication/register',
      payload,
      this.authRequestOptions()
    );
  }

  getClientAuthHeaders(): Record<string, string> {
    const token = this.clientToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  login(email: string, password: string): Observable<{ token: string }> {
    return this.http
      .post<{ token: string }>(
        '/api/authentication/login',
        { email, password },
        this.authRequestOptions()
      )
      .pipe(
        tap((result) => {
          const token = this.extractToken(result);
          if (token) {
            this.exchangeForAppScope(token);
          }
        }),
        catchError((err) => throwError(() => err))
      );
  }

  exchangeForAppScope(baseToken: string): Observable<{ token: string; profileId: string }> {
    return this.http
      .post<{ token: string; profileId: string; targetAppId: string }>(
        '/api/authentication/exchange',
        { targetAppId: 'business-site' },
        this.authRequestOptions(baseToken)
      )
      .pipe(
        tap((result) => {
          if (result?.token) {
            // We don't have the user details here; store minimal info
            // The calling code (login flow) will handle the full hydration
          }
        })
      );
  }

  /**
   * Performs full login + app-scope exchange and stores the resulting session.
   */
  loginAndExchange(
    email: string,
    password: string
  ): Observable<BusinessAuthUser> {
    return new Observable<BusinessAuthUser>((observer) => {
      this.http
        .post<{ token: string; userId?: string; email?: string }>(
          '/api/authentication/login',
          { email, password },
          this.authRequestOptions()
        )
        .subscribe({
          next: (loginResult) => {
            const baseToken = this.extractToken(loginResult);
            if (!baseToken) {
              observer.error(new Error('Login did not return a token'));
              return;
            }
            const authUser = this.buildClientUser(baseToken, {
              email: loginResult.email ?? email,
              userId: loginResult.userId,
            });

            this.storeUser(authUser);
            observer.next(authUser);
            observer.complete();

            this.http
              .post<{ token: string; profileId: string }>(
                '/api/authentication/exchange',
                { targetAppId: 'business-site' },
                this.authRequestOptions(baseToken)
              )
              .subscribe({
                next: (exchangeResult) => {
                  const exchangedUser = this.buildClientUser(
                    baseToken,
                    {
                      email: loginResult.email ?? email,
                      userId: loginResult.userId,
                    },
                    exchangeResult
                  );
                  if (exchangedUser.token) {
                    this.storeUser(exchangedUser);
                  }
                },
                error: () => undefined,
              });
          },
          error: (err) => observer.error(err),
        });
    });
  }

  logout(): void {
    const token = this._user()?.token;
    if (token) {
      this.http
        .post('/api/authentication/logout', { token })
        .subscribe({ error: () => {} });
    }
    this.clearUser();
  }

  getAuthHeaders(): Record<string, string> {
    const token = this.token();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private storeUser(user: BusinessAuthUser): void {
    this._user.set(user);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem(TOKEN_KEY, user.token);
    }
  }

  private clearUser(): void {
    this._user.set(null);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  private loadUser(): BusinessAuthUser | null {
    try {
      // Will only run in browser context; SSR will get null
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as BusinessAuthUser) : null;
    } catch {
      return null;
    }
  }

  private storeClientUser(user: BusinessAuthUser): void {
    this._clientUser.set(user);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(CLIENT_USER_KEY, JSON.stringify(user));
      localStorage.setItem(CLIENT_TOKEN_KEY, user.token);
    }
  }

  private clearClientUser(): void {
    this._clientUser.set(null);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(CLIENT_USER_KEY);
      localStorage.removeItem(CLIENT_TOKEN_KEY);
    }
  }

  private loadClientUser(): BusinessAuthUser | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(CLIENT_USER_KEY);
      return raw ? (JSON.parse(raw) as BusinessAuthUser) : null;
    } catch {
      return null;
    }
  }
}
