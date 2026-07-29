import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { LoginRequest, LoginResponse } from '@optimistic-tanuki/ui-models';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';

export interface DecodedToken {
  userId: string;
  profileId: string;
  email: string;
  exp: number;
  iat: number;
}

@Injectable({
  providedIn: 'root',
})
export class AuthStateService {
  private readonly http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private readonly tokenSubject = new BehaviorSubject<string | null>(null);
  private readonly isAuthenticatedSubject = new BehaviorSubject<boolean>(false);

  public readonly token$ = this.tokenSubject.asObservable();
  public readonly isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor() {
    if (isPlatformBrowser(this.platformId)) void this.restoreSession();
  }

  async login(loginRequest: LoginRequest): Promise<LoginResponse> {
    const response = await firstValueFrom(
      this.http.post<LoginResponse>('/api/authentication/login', loginRequest, {
        headers: {
          'x-ot-app-id': 'video-platform',
          'x-ot-appscope': 'video-platform',
          'X-ot-session-mode': 'cookie',
        },
        withCredentials: true,
      })
    );

    if (!response) {
      throw new Error('Login failed');
    }

    return response;
  }

  private sessionUser: DecodedToken | null = null;

  async restoreSession(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const response = await firstValueFrom(
        this.http.get<{ data: { user: DecodedToken } }>(
          '/api/authentication/session',
          { withCredentials: true }
        )
      );
      this.tokenSubject.next(null);
      this.isAuthenticatedSubject.next(true);
      this.sessionUser = response.data.user;
    } catch {
      this.tokenSubject.next(null);
      this.isAuthenticatedSubject.next(false);
      this.sessionUser = null;
    }
  }

  setToken(token: string): void {
    this.tokenSubject.next(token);
    this.isAuthenticatedSubject.next(true);
  }

  getToken(): string | null {
    return this.tokenSubject.value;
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('selectedProfile');
    }
    this.http
      .post('/api/authentication/logout', {}, { withCredentials: true })
      .subscribe({ error: () => undefined });
    this.tokenSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.sessionUser = null;
  }

  get isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  getDecodedTokenValue(): DecodedToken | null {
    return this.sessionUser;
  }

  getDecodedToken(): Observable<DecodedToken | null> {
    return new Observable((observer) => {
      const decoded = this.getDecodedTokenValue();
      observer.next(decoded);
      observer.complete();
    });
  }
}
