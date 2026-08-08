import {
  Injectable,
  PLATFORM_ID,
  inject,
  signal,
  computed,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  Observable,
  tap,
  catchError,
  throwError,
  map,
  of,
  switchMap,
} from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import { RegisterRequest } from '@optimistic-tanuki/models';

export interface BusinessAuthUser {
  token?: string;
  profileId: string;
  userId: string;
  email: string;
  name?: string;
}

const SESSION_KIND_KEY = 'business-site:session-kind';
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

  private readonly _clientUser = signal<BusinessAuthUser | null>(
    this.loadClientUser()
  );

  readonly clientUser = this._clientUser.asReadonly();
  readonly isClientAuthenticated = computed(() => !!this._clientUser());
  readonly clientToken = computed(() => this._clientUser()?.token ?? null);

  private extractToken(
    response:
      | {
          token?: string;
          newToken?: string;
          data?: { token?: string; newToken?: string };
        }
      | undefined
  ): string | null {
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
      profileId: exchangeClaims.profileId || baseClaims.profileId || '',
      userId: baseClaims.userId || loginResult.userId || '',
      email: loginResult?.email || baseClaims.email || '',
      name: exchangeClaims.name || baseClaims.name || '',
    };
  }

  private exchangeAppToken(
    baseToken: string,
    loginResult: { email?: string; userId?: string },
    storeUser: (user: BusinessAuthUser) => void
  ): Observable<BusinessAuthUser> {
    const baseUser = this.buildClientUser(baseToken, loginResult);

    return this.http
      .post<{ token?: string; newToken?: string; profileId?: string }>(
        '/api/authentication/exchange',
        { targetAppId: 'business-site' },
        this.authRequestOptions(baseToken)
      )
      .pipe(
        map((exchangeResult) => {
          const exchangedUser = this.buildClientUser(
            baseToken,
            loginResult,
            exchangeResult
          );
          storeUser(exchangedUser);
          return exchangedUser;
        }),
        catchError(() => {
          storeUser(baseUser);
          return of(baseUser);
        })
      );
  }

  private authRequestOptions(baseToken?: string) {
    return {
      headers: {
        'x-ot-appscope': BUSINESS_SITE_SCOPE,
        'X-ot-session-mode': 'cookie',
        ...(baseToken ? { Authorization: `Bearer ${baseToken}` } : {}),
      },
      withCredentials: true,
    };
  }

  private sessionUser(email: string): Observable<BusinessAuthUser> {
    return this.http
      .get<{
        data: {
          userId: string;
          profileId?: string;
          email?: string;
          name?: string;
        };
      }>('/api/authentication/session', this.authRequestOptions())
      .pipe(
        map((response) => ({
          userId: response.data.userId,
          profileId: response.data.profileId || '',
          email: response.data.email || email,
          name: response.data.name || '',
        }))
      );
  }

  loginClient(email: string, password: string): Observable<BusinessAuthUser> {
    return this.http
      .post(
        '/api/authentication/login',
        { email, password },
        this.authRequestOptions()
      )
      .pipe(
        switchMap(() => this.sessionUser(email)),
        tap((user) => {
          sessionStorage.setItem(SESSION_KIND_KEY, 'client');
          this.storeClientUser(user);
        })
      );
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

  registerOwner(payload: RegisterRequest): Observable<unknown> {
    return this.http.post(
      '/api/authentication/register',
      payload,
      this.authRequestOptions()
    );
  }

  claimOwnerAccess(): Observable<unknown> {
    return this.http.post(
      '/api/authentication/owner-access',
      {},
      this.authRequestOptions(this.token() ?? undefined)
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
            this.exchangeForAppScope(token).subscribe();
          }
        }),
        catchError((err) => throwError(() => err))
      );
  }

  exchangeForAppScope(
    baseToken: string
  ): Observable<{ token: string; profileId: string }> {
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
    return this.http
      .post(
        '/api/authentication/login',
        { email, password },
        this.authRequestOptions()
      )
      .pipe(
        switchMap(() => this.sessionUser(email)),
        tap((user) => {
          sessionStorage.setItem(SESSION_KIND_KEY, 'owner');
          this.storeUser(user);
        })
      );
  }

  restoreSession(): Observable<boolean> {
    if (!isPlatformBrowser(this.platformId)) return of(false);
    const kind = sessionStorage.getItem(SESSION_KIND_KEY);
    if (kind !== 'owner' && kind !== 'client') return of(false);
    return this.sessionUser('').pipe(
      tap((user) =>
        kind === 'owner' ? this.storeUser(user) : this.storeClientUser(user)
      ),
      map(() => true),
      catchError(() => {
        this.clearUser();
        this.clearClientUser();
        return of(false);
      })
    );
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
  }

  private clearUser(): void {
    this._user.set(null);
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.removeItem(SESSION_KIND_KEY);
    }
  }

  private loadUser(): BusinessAuthUser | null {
    return null;
  }

  private storeClientUser(user: BusinessAuthUser): void {
    this._clientUser.set(user);
  }

  private clearClientUser(): void {
    this._clientUser.set(null);
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.removeItem(SESSION_KIND_KEY);
    }
  }

  private loadClientUser(): BusinessAuthUser | null {
    return null;
  }
}
