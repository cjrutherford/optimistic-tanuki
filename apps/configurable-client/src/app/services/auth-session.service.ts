import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { normalizeAuthReturnTo } from '@optimistic-tanuki/auth-ui';
import { LoginRequest } from '@optimistic-tanuki/ui-models';

export const CONFIGURABLE_CLIENT_APP_SCOPE = 'configurable-client';

export type AuthSessionStatus =
  | 'loading'
  | 'signed-out'
  | 'signed-in'
  | 'expired';

export interface AuthSessionState {
  status: AuthSessionStatus;
  user?: unknown;
  returnTo?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly stateSubject = new BehaviorSubject<AuthSessionState>({
    status: 'loading',
  });
  private restoreInFlight: Promise<boolean> | null = null;

  readonly sessionState$ = this.stateSubject.asObservable();

  get status(): AuthSessionStatus {
    return this.stateSubject.value.status;
  }

  get isSignedIn(): boolean {
    return this.status === 'signed-in';
  }

  restoreSession(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) {
      this.stateSubject.next({ status: 'signed-out' });
      return Promise.resolve(false);
    }

    if (this.restoreInFlight) return this.restoreInFlight;

    const wasSignedIn = this.isSignedIn;
    this.stateSubject.next({ status: 'loading' });
    this.restoreInFlight = firstValueFrom(
      this.http.get<{ data?: unknown }>('/api/authentication/session', {
        withCredentials: true,
        headers: { 'X-ot-appscope': CONFIGURABLE_CLIENT_APP_SCOPE },
      })
    )
      .then((response) => {
        this.stateSubject.next({ status: 'signed-in', user: response?.data });
        return true;
      })
      .catch(() => {
        if (wasSignedIn) {
          this.markExpired();
        } else {
          this.stateSubject.next({ status: 'signed-out' });
        }
        return false;
      })
      .finally(() => {
        this.restoreInFlight = null;
      });

    return this.restoreInFlight;
  }

  async login(request: LoginRequest): Promise<boolean> {
    await firstValueFrom(
      this.http.post('/api/authentication/login', request, {
        withCredentials: true,
        headers: {
          'X-ot-session-mode': 'cookie',
          'X-ot-appscope': CONFIGURABLE_CLIENT_APP_SCOPE,
          'X-ot-app-id': CONFIGURABLE_CLIENT_APP_SCOPE,
        },
      })
    );

    return this.restoreSession();
  }

  markExpired(returnTo?: string): void {
    const currentOrigin =
      typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : 'http://configurable-client.invalid';
    const candidate = returnTo ?? this.currentReturnTo();
    const target = normalizeAuthReturnTo(candidate, { currentOrigin });

    this.stateSubject.next({
      status: 'expired',
      returnTo: target?.isCurrentOrigin ? target.path : '/',
    });
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.http
        .post(
          '/api/authentication/logout',
          {},
          {
            withCredentials: true,
            headers: { 'X-ot-appscope': CONFIGURABLE_CLIENT_APP_SCOPE },
          }
        )
        .subscribe({ error: () => undefined });
    }
    this.stateSubject.next({ status: 'signed-out' });
  }

  private currentReturnTo(): string {
    if (!isPlatformBrowser(this.platformId) || typeof window === 'undefined') {
      return '/';
    }

    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
  }
}
