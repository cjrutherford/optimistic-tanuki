import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthStateService {
  private tokenKey = 'auth_token';
  
  private _currentUser = signal<any>(null);
  
  getDecodedTokenValue(): any {
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
    localStorage.setItem(this.tokenKey, token);
    this._currentUser.set(this.getDecodedTokenValue());
  }

  clearToken(): void {
    localStorage.removeItem(this.tokenKey);
    this._currentUser.set(null);
  }

  isLoggedIn(): boolean {
    return !!this.getDecodedTokenValue();
  }
}