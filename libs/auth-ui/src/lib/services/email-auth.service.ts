import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';

export type EmailActionPurpose =
  | 'verification'
  | 'password-reset'
  | 'magic-link';

@Injectable({ providedIn: 'root' })
export class EmailAuthClientService {
  constructor(private readonly http: HttpClient) {}

  request(
    appId: string,
    email: string,
    purpose: EmailActionPurpose,
    returnPath = '/'
  ) {
    return this.http.post<{ accepted: true }>(
      '/api/authentication/email-action/request',
      { email, purpose, returnPath },
      { headers: new HttpHeaders({ 'x-ot-app-id': appId }) }
    );
  }

  confirmLogin(purpose: 'verification' | 'magic-link', token: string) {
    const endpoint =
      purpose === 'verification' ? 'email-verification' : 'magic-link';
    return this.http.post<{
      appId: string;
      returnPath: string;
      data: { newToken: string };
    }>(`/api/authentication/${endpoint}/confirm`, { token });
  }

  resetPassword(token: string, password: string, confirmation: string) {
    return this.http.post('/api/authentication/password-reset/confirm', {
      token,
      password,
      confirmation,
    });
  }
}
