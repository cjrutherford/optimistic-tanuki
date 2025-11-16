import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import LoginRequest from '@optimistic-tanuki/ui-models';
import RegisterRequest from '@optimistic-tanuki/ui-models';
import { AuthResponse } from '@optimistic-tanuki/ui-models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly API_URL = 'http://localhost:3000';
  private readonly TOKEN_KEY = 'auth_token';
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  private hasToken(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  login(email: string, password: string, mfa?: string): Observable<AuthResponse> {
    const loginData: LoginRequest = { email, password, mfa };
    return this.http.post<AuthResponse>(`${this.API_URL}/authentication/login`, loginData).pipe(
      tap((response) => {
        if (response.data?.newToken) {
          localStorage.setItem(this.TOKEN_KEY, response.data.newToken);
          this.isAuthenticatedSubject.next(true);
        }
      })
    );
  }

  register(
    email: string,
    fn: string,
    ln: string,
    password: string,
    confirm: string,
    bio?: string
  ): Observable<AuthResponse> {
    const registerData: RegisterRequest = { email, fn, ln, password, confirm, bio };
    return this.http.post<AuthResponse>(`${this.API_URL}/authentication/register`, registerData).pipe(
      tap((response) => {
        if (response.data?.newToken) {
          localStorage.setItem(this.TOKEN_KEY, response.data.newToken);
          this.isAuthenticatedSubject.next(true);
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return this.hasToken();
  }
}
