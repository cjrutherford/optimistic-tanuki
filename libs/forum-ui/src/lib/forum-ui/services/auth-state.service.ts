import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class AuthStateService {
  private readonly platformId = inject(PLATFORM_ID);
  private tokenKey = 'auth_token';

  private _currentUser = signal<any>(null);

  getDecodedTokenValue(): any {
    if (!this.hasLocalStorage()) {
      return null;
    }

    const token = localStorage.getItem(this.tokenKey);
    if (!token) return null;

    try {
      // Simple base64 decode for JWT payload (2nd part)
      const payload = token.split('.')[1];
      if (!payload) return null;

      const decoded = JSON.parse(atob(payload));
      return decoded;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  getCurrentUser() {
    if (!this._currentUser()) {
      const decodedToken = this.getDecodedTokenValue();
      this._currentUser.set(decodedToken);
    }
    return this._currentUser();
  }

  setToken(token: string): void {
    if (!this.hasLocalStorage()) {
      return;
    }

    localStorage.setItem(this.tokenKey, token);
    this._currentUser.set(this.getDecodedTokenValue());
  }

  clearToken(): void {
    if (!this.hasLocalStorage()) {
      this._currentUser.set(null);
      return;
    }

    localStorage.removeItem(this.tokenKey);
    this._currentUser.set(null);
  }

  isLoggedIn(): boolean {
    return !!this.getDecodedTokenValue();
  }

  private hasLocalStorage(): boolean {
    return (
      isPlatformBrowser(this.platformId) && typeof localStorage !== 'undefined'
    );
  }
}
