import { Injectable } from '@angular/core';
import { ExchangedToken } from './sso.types';

const SSO_SESSION_STORAGE_KEY = 'ot.registry.ssoSession';

@Injectable({ providedIn: 'root' })
export class SsoSessionService {
  storeSession(session: ExchangedToken): void {
    localStorage.setItem(SSO_SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  getSession(): ExchangedToken | null {
    const stored = localStorage.getItem(SSO_SESSION_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as ExchangedToken) : null;
  }

  getToken(): string | null {
    return this.getSession()?.token ?? null;
  }

  clearSession(): void {
    localStorage.removeItem(SSO_SESSION_STORAGE_KEY);
  }
}
