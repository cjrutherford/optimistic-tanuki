import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
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
  private readonly tokenSubject = new BehaviorSubject<string | null>(null);
  private readonly isAuthenticatedSubject = new BehaviorSubject<boolean>(false);

  public readonly token$ = this.tokenSubject.asObservable();
  public readonly isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor() {
    const platformId = inject(PLATFORM_ID);
    // Check for stored token on initialization
    if (isPlatformBrowser(platformId)) {
      const storedToken = localStorage.getItem('authToken');
      if (storedToken) {
        this.setToken(storedToken);
      }
    }
  }

  async login(loginRequest: LoginRequest): Promise<LoginResponse> {
    const response = await this.http
      .post<LoginResponse>('/api/authentication/login', loginRequest)
      .toPromise();
    
    if (!response) {
      throw new Error('Login failed');
    }
    
    return response;
  }

  setToken(token: string): void {
    const platformId = inject(PLATFORM_ID);
    if (isPlatformBrowser(platformId)) {
      localStorage.setItem('authToken', token);
    }
    this.tokenSubject.next(token);
    this.isAuthenticatedSubject.next(true);
  }

  getToken(): string | null {
    return this.tokenSubject.value;
  }

  logout(): void {
    const platformId = inject(PLATFORM_ID);
    if (isPlatformBrowser(platformId)) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('selectedProfile');
    }
    this.tokenSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  get isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  getDecodedTokenValue(): DecodedToken | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      return jwtDecode<DecodedToken>(token);
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  getDecodedToken(): Observable<DecodedToken | null> {
    return new Observable((observer) => {
      const decoded = this.getDecodedTokenValue();
      observer.next(decoded);
      observer.complete();
    });
  }
}
