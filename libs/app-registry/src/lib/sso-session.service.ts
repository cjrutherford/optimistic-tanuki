import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ExchangedToken } from './sso.types';

const SSO_SESSION_STORAGE_KEY = 'ot.registry.ssoSession';

@Injectable({ providedIn: 'root' })
export class SsoSessionService {
  constructor(@Inject(PLATFORM_ID) private readonly platformId: object) {}

  storeSession(session: ExchangedToken): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    localStorage.setItem(SSO_SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  getSession(): ExchangedToken | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    const stored = localStorage.getItem(SSO_SESSION_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as ExchangedToken) : null;
  }

  getToken(): string | null {
    return this.getSession()?.token ?? null;
  }

  clearSession(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    localStorage.removeItem(SSO_SESSION_STORAGE_KEY);
  }
}
