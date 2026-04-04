import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL, LoginRequest } from '@optimistic-tanuki/ui-models';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/authentication`;

  login(data: LoginRequest) {
    return firstValueFrom(
      this.http.post<{ data: { newToken: string } }>(
        `${this.baseUrl}/login`,
        data
      )
    );
  }
}
