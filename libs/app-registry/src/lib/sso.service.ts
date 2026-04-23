import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ExchangedToken, TokenValidationResponse } from './sso.types';

interface GatewayTokenValidationResponse {
  valid?: boolean;
  isValid?: boolean;
  userId?: string;
  profileId?: string;
  expiresAt?: string;
  data?: {
    userId?: string;
    profileId?: string;
    exp?: number;
  };
}

export const APP_REGISTRY_AUTH_API_URL = new InjectionToken<string>(
  'APP_REGISTRY_AUTH_API_URL',
  {
    providedIn: 'root',
    factory: () => '/api/authentication',
  }
);

@Injectable({ providedIn: 'root' })
export class SsoService {
  constructor(
    private readonly http: HttpClient,
    @Inject(APP_REGISTRY_AUTH_API_URL)
    private readonly authApiUrl = '/api/authentication'
  ) {}

  validateToken(
    token: string,
    userId?: string
  ): Observable<TokenValidationResponse> {
    return this.http
      .post<GatewayTokenValidationResponse>(`${this.authApiUrl}/validate`, {
        token,
        ...(userId ? { userId } : {}),
      })
      .pipe(
        map((response) => ({
          valid: response.valid ?? response.isValid ?? false,
          userId: response.userId ?? response.data?.userId,
          profileId: response.profileId ?? response.data?.profileId,
          expiresAt:
            response.expiresAt ??
            (response.data?.exp
              ? new Date(response.data.exp * 1000).toISOString()
              : undefined),
        }))
      );
  }

  exchangeToken(
    token: string,
    targetAppId: string
  ): Observable<ExchangedToken> {
    return this.http.post<ExchangedToken>(
      `${this.authApiUrl}/exchange`,
      { targetAppId },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }
}
