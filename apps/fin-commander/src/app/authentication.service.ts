import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  API_BASE_URL,
  LoginRequest,
  RegisterRequest,
  UserDto,
} from '@optimistic-tanuki/ui-models';
import { BehaviorSubject, firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationService {
  readonly isAuthenticated = new BehaviorSubject<boolean>(false);
  readonly userData = new BehaviorSubject<UserDto | null>(null);
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly baseUrl = `${this.apiBaseUrl}/authentication`;

  register(data: RegisterRequest) {
    return this.http.post(`${this.baseUrl}/register`, data);
  }

  login(data: LoginRequest) {
    return firstValueFrom(
      this.http.post<{ data: { newToken: string } }>(
        `${this.baseUrl}/login`,
        data
      )
    );
  }

  setToken(token: string) {
    const payload = JSON.parse(atob(token.split('.')[1]));
    this.userData.next(payload);
    this.isAuthenticated.next(true);

    const expiresAt = payload.exp ? payload.exp * 1000 : Date.now();
    const timeout = Math.max(expiresAt - Date.now(), 0);

    setTimeout(() => {
      this.isAuthenticated.next(false);
      this.userData.next(null);
    }, timeout);
  }
}
