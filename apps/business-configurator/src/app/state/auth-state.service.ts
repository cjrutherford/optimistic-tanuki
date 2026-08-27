import { Inject, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoginRequest, ProfileDto } from '@optimistic-tanuki/ui-models';
import { AuthenticationService } from '../services/authentication.service';

export interface UserData {
  userId: string;
  name?: string;
  email?: string;
  profileId: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthStateService {
  private readonly namespace = 'business-configurator';
  private readonly profilesKey = `${this.namespace}-profiles`;
  private readonly selectedProfileKey = `${this.namespace}-selectedProfile`;

  private readonly authService = inject(AuthenticationService);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly tokenSubject = new BehaviorSubject<string | null>(null);
  private readonly isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private readonly decodedTokenSubject = new BehaviorSubject<UserData | null>(
    null
  );

  private authenticated = false;

  isAuthenticated$(): Observable<boolean> {
    return this.isAuthenticatedSubject.asObservable();
  }

  get isAuthenticated(): boolean {
    return this.authenticated;
  }

  async login(
    loginRequest: LoginRequest
  ): Promise<{ data: Record<string, never> }> {
    const response = await this.authService.login(loginRequest);
    await this.restoreSession();
    return response;
  }

  setToken(token: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.tokenSubject.next(token);
      this.isAuthenticatedSubject.next(true);
      this.authenticated = true;
    }
  }

  async restoreSession(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const response = await this.authService.currentSession();
      this.tokenSubject.next(null);
      this.isAuthenticatedSubject.next(true);
      this.decodedTokenSubject.next({
        userId: response.data.userId,
        name: response.data.name,
        email: response.data.email,
        profileId: '',
      });
      this.authenticated = true;
    } catch {
      this.tokenSubject.next(null);
      this.isAuthenticatedSubject.next(false);
      this.decodedTokenSubject.next(null);
      this.authenticated = false;
    }
  }

  logout(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.removeItem(this.profilesKey);
    localStorage.removeItem(this.selectedProfileKey);
    this.tokenSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.decodedTokenSubject.next(null);
    this.authenticated = false;
    void this.authService.logout().catch(() => undefined);
  }

  getToken(): string | null {
    return this.tokenSubject.value;
  }

  getDecodedTokenValue(): UserData | null {
    return this.decodedTokenSubject.value;
  }

  persistProfiles(profiles: ProfileDto[] | null): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (profiles) {
      localStorage.setItem(this.profilesKey, JSON.stringify(profiles));
    } else {
      localStorage.removeItem(this.profilesKey);
    }
  }

  getPersistedProfiles(): ProfileDto[] | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const profiles = localStorage.getItem(this.profilesKey);
    return profiles ? (JSON.parse(profiles) as ProfileDto[]) : null;
  }

  persistSelectedProfile(profile: ProfileDto | null): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (profile) {
      localStorage.setItem(this.selectedProfileKey, JSON.stringify(profile));
    } else {
      localStorage.removeItem(this.selectedProfileKey);
    }
  }

  getPersistedSelectedProfile(): ProfileDto | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const profile = localStorage.getItem(this.selectedProfileKey);
    return profile ? (JSON.parse(profile) as ProfileDto) : null;
  }
}
