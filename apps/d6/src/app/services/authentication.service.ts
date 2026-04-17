import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthStateService } from './auth-state.service';
import { LoginRequest, RegisterRequest } from '../types';

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  private readonly http = inject(HttpClient);
  private readonly authState = inject(AuthStateService);
  private readonly baseUrl = '/api/authentication';

  login(data: LoginRequest): Observable<{ data: { newToken: string } }> {
    return this.http.post<{ data: { newToken: string } }>(
      `${this.baseUrl}/login`,
      data
    );
  }

  register(data: RegisterRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/register`, data);
  }

  setAuthToken(token: string): void {
    this.authState.setToken(token);
  }

  logout(): void {
    this.authState.logout();
  }

  isAuthenticated(): boolean {
    return this.authState.isLoggedIn();
  }

  getToken(): string | null {
    return this.authState.getToken();
  }
}
