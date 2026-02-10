import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private readonly TOKEN_KEY = 'ot-d6_authToken';
  private readonly PROFILES_KEY = 'ot-d6_profiles';
  private readonly SELECTED_PROFILE_KEY = 'ot-d6_selectedProfile';
  private readonly platformId = inject(PLATFORM_ID);

  private _token = signal<string | null>(this.loadToken());
  private _isAuthenticated = signal<boolean>(!!this.loadToken());
  private _user = signal<any>(this.loadUserData());
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

  setToken(token: string): void {
    this._token.set(token);
    if (this.isBrowser()) {
      localStorage.setItem(this.TOKEN_KEY, token);
    }
    this._isAuthenticated.set(true);

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      this.setUser(payload);
    } catch {
      // Invalid token format
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
