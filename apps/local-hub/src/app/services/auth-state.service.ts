import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { AuthenticationService } from './authentication.service';
import { LoginRequest } from '@optimistic-tanuki/ui-models';
import { HttpClient } from '@angular/common/http';

export interface UserData {
  userId: string;
  name: string;
  email: string;
  profileId?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthStateService {
  private isAuthenticatedSubject: BehaviorSubject<boolean>;
  private userDataSubject: BehaviorSubject<UserData | null>;
  private _isAuthenticated = false;
  private sessionRestorePromise: Promise<void> | null = null;
  private restoreGeneration = 0;

  isAuthenticated$: Observable<boolean>;
  userData$: Observable<UserData | null>;

  private authService = inject(AuthenticationService);
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      this.isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
      this.userDataSubject = new BehaviorSubject<UserData | null>(null);
      this.isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
      this.userData$ = this.userDataSubject.asObservable();
      return;
    }

    this.isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
    this.userDataSubject = new BehaviorSubject<UserData | null>(null);
    this.isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
    this.userData$ = this.userDataSubject.asObservable();
    this.sessionRestorePromise = this.restoreSession();
  }

  get isAuthenticated(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    return this._isAuthenticated;
  }

  getUserData(): UserData | null {
    return this.userDataSubject.value;
  }

  getToken(): string | null {
    return null;
  }

  async login(email: string, password: string): Promise<void> {
    const request: LoginRequest = { email, password };
    await this.authService.login(request);
    await this.restoreSession();
  }

  async restoreSession(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const generation = ++this.restoreGeneration;

    try {
      const response = await this.authService.currentSession();
      if (generation !== this.restoreGeneration) return;
      this._isAuthenticated = true;
      this.isAuthenticatedSubject.next(true);
      this.userDataSubject.next(response.data as UserData);
    } catch {
      if (generation !== this.restoreGeneration) return;
      this._isAuthenticated = false;
      this.isAuthenticatedSubject.next(false);
      this.userDataSubject.next(null);
    }
  }

  /**
   * Wait for the constructor's cookie-session restore to settle. Guards use
   * this shared promise so they never consume the initial `false` value while
   * the browser session request is still in flight.
   */
  waitForSessionRestore(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return Promise.resolve();
    return (this.sessionRestorePromise ??= this.restoreSession());
  }

  /** Returns the caller's profileId, falling back to userId, then empty string. */
  getActingProfileId(): string {
    const data = this.userDataSubject.value;
    return data?.profileId || data?.userId || '';
  }

  logout(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.http
      .post('/api/authentication/logout', {}, { withCredentials: true })
      .subscribe({ error: () => undefined });
    this._isAuthenticated = false;
    this.isAuthenticatedSubject.next(false);
    this.userDataSubject.next(null);
  }
}
