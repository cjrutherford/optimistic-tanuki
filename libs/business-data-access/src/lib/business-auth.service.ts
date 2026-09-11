import {
  Injectable,
  PLATFORM_ID,
  inject,
  signal,
  computed,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
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
import {
  BUSINESS_SITE_APP_SCOPE,
  BusinessAuthState,
  BusinessAuthStateEvent,
  BusinessIdentity,
  BusinessSessionKind,
  createBusinessAuthState,
  transitionBusinessAuthState,
} from './business-auth.state';

export interface BusinessAuthUser extends BusinessIdentity {
  token?: string;
}

const SESSION_KIND_KEY = 'business-site:session-kind';
const BUSINESS_AUTH_STORAGE_KEYS = [
  'business-site:user',
  'business-site:token',
  'business-site:client-user',
  'business-site:client-token',
] as const;

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

  private readonly _authState = signal<BusinessAuthState>(
    createBusinessAuthState()
  );

  readonly authState = this._authState.asReadonly();
  readonly session = this.authState;

  private readonly _user = signal<BusinessAuthUser | null>(this.loadUser());

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => !!this._user());
  readonly token = computed(() => this._user()?.token ?? null);

  private readonly _clientUser = signal<BusinessAuthUser | null>(
    this.loadClientUser()
  );

  private sessionRestoreVersion = 0;

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
        'x-ot-appscope': BUSINESS_SITE_APP_SCOPE,
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
          this.setSessionKind('client');
          this.storeClientUser(user, 'client');
        })
      );
  }

  refreshClientSession(): Observable<BusinessAuthUser> {
    return this.sessionUser('').pipe(
      tap((user) => {
        this.setSessionKind('client');
        this.storeClientUser(user, 'client');
      })
    );
  }

  logoutClient(): void {
    this.logoutWithCookieSession();
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
          this.setSessionKind('owner');
          this.storeUser(user, 'owner');
        })
      );
  }

  restoreSession(): Observable<boolean> {
    if (!isPlatformBrowser(this.platformId)) return of(false);
    const kind = sessionStorage.getItem(SESSION_KIND_KEY);
    if (kind !== 'owner' && kind !== 'client') {
      this.invalidatePendingRestore();
      this.transition({ type: 'sign-out' });
      return of(false);
    }

    const restoreVersion = ++this.sessionRestoreVersion;
    this.transition({ type: 'restore-start' });
    return this.sessionUser('').pipe(
      tap((user) => {
        if (restoreVersion !== this.sessionRestoreVersion) return;
        if (kind === 'owner') {
          this.storeUser(user, 'owner');
        } else {
          this.storeClientUser(user, 'client');
        }
      }),
      map(() => restoreVersion === this.sessionRestoreVersion),
      catchError((error: unknown) => {
        if (restoreVersion !== this.sessionRestoreVersion) return of(false);
        this.clearSessionState({
          type:
            error instanceof HttpErrorResponse
              ? error.status === 401
                ? 'unauthorized'
                : 'expiry'
              : 'expiry',
        });
        return of(false);
      })
    );
  }

  logout(): void {
    this.logoutWithCookieSession();
  }

  markUnauthorized(returnTo?: string | null): void {
    this.clearSessionState({ type: 'unauthorized', returnTo });
  }

  markExpired(returnTo?: string | null): void {
    this.clearSessionState({ type: 'expiry', returnTo });
  }

  getAuthHeaders(): Record<string, string> {
    const token = this.token();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private storeUser(user: BusinessAuthUser, kind: BusinessSessionKind): void {
    this._user.set(user);
    this.setSignedInState(user, kind);
  }

  private setSessionKind(kind: BusinessSessionKind): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    sessionStorage.setItem(SESSION_KIND_KEY, kind);
  }

  private setSignedInState(
    user: BusinessAuthUser,
    kind: BusinessSessionKind
  ): void {
    const identity: BusinessIdentity = {
      userId: user.userId,
      profileId: user.profileId,
      email: user.email,
    };

    if (user.name !== undefined) {
      identity.name = user.name;
    }

    this.transition({
      type: 'restore-success',
      identity,
      session: {
        kind,
        appScope: BUSINESS_SITE_APP_SCOPE,
        transport: 'cookie',
      },
    });
  }

  private transition(event: BusinessAuthStateEvent): void {
    this._authState.update((state) =>
      transitionBusinessAuthState(state, event)
    );
  }

  private clearSessionState(
    event: Extract<
      BusinessAuthStateEvent,
      { type: 'unauthorized' | 'expiry' | 'sign-out' }
    >
  ): void {
    this.invalidatePendingRestore();
    this._user.set(null);
    this._clientUser.set(null);

    if (isPlatformBrowser(this.platformId)) {
      for (const key of BUSINESS_AUTH_STORAGE_KEYS) {
        localStorage.removeItem(key);
      }
      sessionStorage.removeItem(SESSION_KIND_KEY);
    }

    this.transition(event);
  }

  private logoutWithCookieSession(): void {
    this.clearSessionState({ type: 'sign-out' });
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.http
      .post('/api/authentication/logout', {}, this.authRequestOptions())
      .subscribe({ error: () => undefined });
  }

  private invalidatePendingRestore(): void {
    this.sessionRestoreVersion += 1;
  }

  private loadUser(): BusinessAuthUser | null {
    return null;
  }

  private storeClientUser(
    user: BusinessAuthUser,
    kind: BusinessSessionKind
  ): void {
    this._clientUser.set(user);
    this.setSignedInState(user, kind);
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
