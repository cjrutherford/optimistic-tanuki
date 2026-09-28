import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { Observable, finalize, map, of, switchMap, tap } from 'rxjs';

export interface CustomerUser {
  userId: string;
  email: string;
  name: string;
  profileId?: string;
}

export interface CustomerRegistrationResult {
  success: true;
  user: CustomerUser | null;
  verificationRequired: boolean;
}

const authRequestOptions = () => ({
  headers: {
    'x-ot-appscope': 'whitebox-field-flow',
    'x-ot-session-mode': 'cookie',
    'x-ot-app-id': 'client-interface',
  },
  withCredentials: true,
});

@Injectable({
  providedIn: 'root',
})
export class CustomerAuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  readonly currentUser = signal<CustomerUser | null>(null);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.restoreSession();
    }
  }

  get isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  private restoreSession(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.fetchServerSession().subscribe({
      next: (user) => this.currentUser.set(user),
      error: () => this.currentUser.set(null),
    });
  }

  private fetchServerSession(): Observable<CustomerUser> {
    return this.http
      .get<unknown>('/api/authentication/session', authRequestOptions())
      .pipe(
        map((response) => this.toCustomerUser(response)),
        tap((user) => this.currentUser.set(user))
      );
  }

  register(data: {
    name: string;
    email: string;
    password: string;
  }): Observable<CustomerRegistrationResult> {
    this.currentUser.set(null);
    const nameParts = data.name.trim().split(/\s+/).filter(Boolean);
    const payload = {
      fn: nameParts.shift() ?? '',
      ln: nameParts.join(' '),
      email: data.email,
      password: data.password,
      confirm: data.password,
      bio: '',
    };

    return this.http
      .post<unknown>(
        '/api/authentication/register',
        payload,
        authRequestOptions()
      )
      .pipe(
        switchMap((response) => {
          if (this.registrationRequiresVerification(response)) {
            return of({
              success: true as const,
              user: null,
              verificationRequired: true,
            });
          }
          return this.fetchServerSession().pipe(
            map((user) => ({
              success: true as const,
              user,
              verificationRequired: false,
            }))
          );
        })
      );
  }

  login(data: {
    email: string;
    password: string;
  }): Observable<{ success: boolean; user: CustomerUser }> {
    this.currentUser.set(null);
    const payload = {
      email: data.email,
      password: data.password,
    };

    return this.http
      .post<unknown>('/api/authentication/login', payload, authRequestOptions())
      .pipe(
        switchMap(() => this.fetchServerSession()),
        map((user) => ({ success: true, user }))
      );
  }

  logout(): Observable<unknown> {
    return this.http
      .post<unknown>('/api/authentication/logout', {}, authRequestOptions())
      .pipe(finalize(() => this.currentUser.set(null)));
  }

  private registrationRequiresVerification(response: unknown): boolean {
    const data =
      this.isRecord(response) && this.isRecord(response['data'])
        ? response['data']
        : response;
    return this.isRecord(data) && data['verificationPending'] === true;
  }

  private toCustomerUser(response: unknown): CustomerUser {
    const data =
      this.isRecord(response) && this.isRecord(response['data'])
        ? response['data']
        : response;
    if (!this.isRecord(data)) {
      throw new Error('Authentication session did not include an identity');
    }

    const userId = data['userId'];
    const email = data['email'];
    const name = data['name'];
    if (
      typeof userId !== 'string' ||
      !userId.trim() ||
      typeof email !== 'string' ||
      !email.trim() ||
      typeof name !== 'string' ||
      !name.trim()
    ) {
      throw new Error(
        'Authentication session did not include a complete identity'
      );
    }

    const profileId = data['profileId'];
    return {
      userId: userId.trim(),
      email: email.trim(),
      name: name.trim(),
      ...(typeof profileId === 'string' && profileId.trim()
        ? { profileId: profileId.trim() }
        : {}),
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object';
  }
}
