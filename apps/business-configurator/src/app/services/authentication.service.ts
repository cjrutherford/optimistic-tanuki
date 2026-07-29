import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  API_BASE_URL,
  LoginRequest,
  UserDto,
} from '@optimistic-tanuki/ui-models';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/authentication`;

  login(data: LoginRequest) {
    return firstValueFrom(
      this.http.post<{ data: Record<string, never> }>(
        `${this.baseUrl}/login`,
        data,
        { headers: { 'X-ot-session-mode': 'cookie' }, withCredentials: true }
      )
    );
  }

  currentSession() {
    return firstValueFrom(
      this.http.get<{ data: { user: UserDto } }>(`${this.baseUrl}/session`, {
        withCredentials: true,
      })
    );
  }

  logout() {
    return firstValueFrom(
      this.http.post(`${this.baseUrl}/logout`, {}, { withCredentials: true })
    );
  }
}
