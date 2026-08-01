import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private readonly TOKEN_KEY = 'ot-d6_authToken';
  private readonly PROFILES_KEY = 'ot-d6_profiles';
  private readonly SELECTED_PROFILE_KEY = 'ot-d6_selectedProfile';
  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);

  private _token = signal<string | null>(null);
  private _isAuthenticated = signal<boolean>(false);
  private _user = signal<any>(null);
  private _selectedProfile = signal<any>(this.loadSelectedProfile());

  get token() {
    return this._token.asReadonly();
  }

  get isAuthenticated() {
    return this._isAuthenticated.asReadonly();
  }

  get user() {
    return this._user.asReadonly();
  }

  get selectedProfile() {
    return this._selectedProfile.asReadonly();
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  constructor() {
    if (this.isBrowser()) {
      void this.restoreSession();
    }
  }

  async restoreSession(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ data: { user: any } }>('/api/authentication/session', {
          withCredentials: true,
        })
      );
      this._token.set(null);
      this._user.set(response.data.user);
      this._isAuthenticated.set(true);
    } catch {
      this._token.set(null);
      this._user.set(null);
      this._isAuthenticated.set(false);
    }
  }

  private loadToken(): string | null {
    if (!this.isBrowser()) {
      return null;
    }
    try {
      return localStorage.getItem(this.TOKEN_KEY);
    } catch {
      return null;
    }
  }

  private loadUserData(): any {
    if (!this.isBrowser()) {
      return null;
    }
    try {
      const data = localStorage.getItem(this.PROFILES_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  private loadSelectedProfile(): any {
    if (!this.isBrowser()) {
      return null;
    }
    try {
      const data = localStorage.getItem(this.SELECTED_PROFILE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  getToken(): string | null {
    return this._token();
  }

  setToken(token?: string): void {
    if (!token) {
      void this.restoreSession();
      return;
    }
    this._token.set(token);
    if (this.isBrowser()) {
      localStorage.removeItem(this.TOKEN_KEY);
    }
    this._isAuthenticated.set(true);

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      this.setUser(payload);
    } catch {
      // Invalid token format
    }
  }

  async restoreSession(): Promise<boolean> {
    if (!this.isBrowser()) return false;
    try {
      const response = await firstValueFrom(
        this.http.get<{ data: any }>('/api/authentication/session', {
          withCredentials: true,
        })
      );
      this._token.set(null);
      localStorage.removeItem(this.TOKEN_KEY);
      this._isAuthenticated.set(true);
      this.setUser(response.data);
      return true;
    } catch {
      return false;
    }
  }

  setUser(user: any): void {
    this._user.set(user);
    if (this.isBrowser()) {
      localStorage.setItem(this.PROFILES_KEY, JSON.stringify(user));
    }
  }

  persistSelectedProfile(profile: any): void {
    this._selectedProfile.set(profile);
    if (this.isBrowser()) {
      if (profile) {
        localStorage.setItem(
          this.SELECTED_PROFILE_KEY,
          JSON.stringify(profile)
        );
      } else {
        localStorage.removeItem(this.SELECTED_PROFILE_KEY);
      }
    }
  }

  getPersistedSelectedProfile(): any {
    return this.loadSelectedProfile();
  }

  logout(): void {
    const token = this.getToken();
    this.http
      .post('/api/authentication/logout', token ? { token } : {}, {
        withCredentials: true,
      })
      .subscribe({ error: () => {} });
    this._token.set(null);
    this._isAuthenticated.set(false);
    this._user.set(null);
    this._selectedProfile.set(null);
    if (this.isBrowser()) {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.PROFILES_KEY);
      localStorage.removeItem(this.SELECTED_PROFILE_KEY);
    }
  }

  isLoggedIn(): boolean {
    return this._isAuthenticated();
  }

  getDecodedTokenValue(): any {
    const token = this._token();
    if (!token) return null;
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch {
      return null;
    }
  }
}
