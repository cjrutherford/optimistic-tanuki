import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RegisterRequest } from '@optimistic-tanuki/ui-models';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationService {
  private readonly http = inject(HttpClient);

  register(registerRequest: RegisterRequest): Observable<any> {
    return this.http.post('/api/authentication/register', registerRequest, {
      headers: {
        'x-ot-app-id': 'video-platform',
        'x-ot-appscope': 'video-platform',
        'X-ot-session-mode': 'cookie',
      },
      withCredentials: true,
    });
  }

  confirmEmail(token: string): Observable<any> {
    return this.http.post(
      '/api/authentication/confirm',
      { token },
      { headers: { 'X-ot-session-mode': 'cookie' }, withCredentials: true }
    );
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post(
      '/api/authentication/forgot-password',
      { email },
      { headers: { 'X-ot-session-mode': 'cookie' }, withCredentials: true }
    );
  }

  resetPassword(token: string, newPassword: string): Observable<any> {
    return this.http.post(
      '/api/authentication/reset-password',
      { token, newPassword },
      { headers: { 'X-ot-session-mode': 'cookie' }, withCredentials: true }
    );
  }
}
