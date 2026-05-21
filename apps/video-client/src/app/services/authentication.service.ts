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
    return this.http.post('/api/authentication/register', registerRequest);
  }

  confirmEmail(token: string): Observable<any> {
    return this.http.post('/api/authentication/confirm', { token });
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post('/api/authentication/forgot-password', { email });
  }

  resetPassword(token: string, newPassword: string): Observable<any> {
    return this.http.post('/api/authentication/reset-password', { token, newPassword });
  }
}
