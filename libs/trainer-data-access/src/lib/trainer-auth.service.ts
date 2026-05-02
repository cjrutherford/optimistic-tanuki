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

export interface TrainerAuthUser {
  token: string;
  profileId: string;
  userId: string;
  email: string;
}

const TOKEN_KEY = 'trainer-site:token';
const USER_KEY = 'trainer-site:user';
const CLIENT_USER_KEY = 'trainer-site:client-user';
const CLIENT_TOKEN_KEY = 'trainer-site:client-token';

@Injectable({ providedIn: 'root' })
export class TrainerAuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly _user = signal<TrainerAuthUser | null>(this.loadUser());

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => !!this._user());
  readonly token = computed(() => this._user()?.token ?? null);

  private readonly _clientUser = signal<TrainerAuthUser | null>(this.loadClientUser());

  readonly clientUser = this._clientUser.asReadonly();
  readonly isClientAuthenticated = computed(() => !!this._clientUser());
  readonly clientToken = computed(() => this._clientUser()?.token ?? null);

  loginClient(email: string, password: string): Observable<TrainerAuthUser> {
    return new Observable<TrainerAuthUser>((observer) => {
      this.http
        .post<{ token: string; userId?: string; email?: string }>(
          '/api/authentication/login',
          { email, password }
        )
        .subscribe({
          next: (loginResult) => {
            const baseToken = loginResult?.token;
            if (!baseToken) {
              observer.error(new Error('Login did not return a token'));
              return;
            }
            this.http
              .post<{ token: string; profileId: string }>(
                '/api/authentication/exchange',
                { targetAppId: 'trainer-site' },
                { headers: { Authorization: `Bearer ${baseToken}` } }
              )
              .subscribe({
                next: (exchangeResult) => {
                  const authUser: TrainerAuthUser = {
                    token: exchangeResult.token,
                    profileId: exchangeResult.profileId,
                    userId: loginResult.userId ?? '',
                    email: loginResult.email ?? email,
                  };
                  this.storeClientUser(authUser);
                  observer.next(authUser);
                  observer.complete();
                },
                error: (err) => observer.error(err),
              });
          },
          error: (err) => observer.error(err),
        });
    });
  }

  logoutClient(): void {
    this.clearClientUser();
  }

  getClientAuthHeaders(): Record<string, string> {
    const token = this.clientToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  login(email: string, password: string): Observable<{ token: string }> {
    return this.http
      .post<{ token: string }>('/api/authentication/login', { email, password })
      .pipe(
        tap((result) => {
          if (result?.token) {
            this.exchangeForAppScope(result.token);
          }
        }),
        catchError((err) => throwError(() => err))
      );
  }

  exchangeForAppScope(baseToken: string): Observable<{ token: string; profileId: string }> {
    return this.http
      .post<{ token: string; profileId: string; targetAppId: string }>(
        '/api/authentication/exchange',
        { targetAppId: 'trainer-site' },
        { headers: { Authorization: `Bearer ${baseToken}` } }
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
  ): Observable<TrainerAuthUser> {
    return new Observable<TrainerAuthUser>((observer) => {
      this.http
        .post<{ token: string; userId?: string; email?: string }>(
          '/api/authentication/login',
          { email, password }
        )
        .subscribe({
          next: (loginResult) => {
            const baseToken = loginResult?.token;
            if (!baseToken) {
              observer.error(new Error('Login did not return a token'));
              return;
            }

            this.http
              .post<{ token: string; profileId: string }>(
                '/api/authentication/exchange',
                { targetAppId: 'trainer-site' },
                { headers: { Authorization: `Bearer ${baseToken}` } }
              )
              .subscribe({
                next: (exchangeResult) => {
                  const authUser: TrainerAuthUser = {
                    token: exchangeResult.token,
                    profileId: exchangeResult.profileId,
                    userId: loginResult.userId ?? '',
                    email: loginResult.email ?? email,
                  };
                  this.storeUser(authUser);
                  observer.next(authUser);
                  observer.complete();
                },
                error: (err) => observer.error(err),
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

  private storeUser(user: TrainerAuthUser): void {
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

  private loadUser(): TrainerAuthUser | null {
    try {
      // Will only run in browser context; SSR will get null
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as TrainerAuthUser) : null;
    } catch {
      return null;
    }
  }

  private storeClientUser(user: TrainerAuthUser): void {
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

  private loadClientUser(): TrainerAuthUser | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(CLIENT_USER_KEY);
      return raw ? (JSON.parse(raw) as TrainerAuthUser) : null;
    } catch {
      return null;
    }
  }
}
