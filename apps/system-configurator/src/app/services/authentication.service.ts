import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL, LoginRequest } from '@optimistic-tanuki/ui-models';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationService {
  private readonly baseUrl: string;

  constructor(
    @Inject(API_BASE_URL) apiBaseUrl: string,
    private readonly http: HttpClient
  ) {
    this.baseUrl = `${apiBaseUrl}/authentication`;
  }

  login(data: LoginRequest) {
    return firstValueFrom(
      this.http.post<{ data: { newToken: string } }>(
        `${this.baseUrl}/login`,
        data
      )
    );
  }
}
