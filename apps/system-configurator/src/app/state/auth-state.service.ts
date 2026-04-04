import { Inject, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
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
  private readonly namespace = 'hai-system-configurator';
  private readonly tokenKey = `${this.namespace}-authToken`;
  private readonly profilesKey = `${this.namespace}-profiles`;
  private readonly selectedProfileKey = `${this.namespace}-selectedProfile`;

  private readonly authService = inject(AuthenticationService);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly tokenSubject = new BehaviorSubject<string | null>(null);
  private readonly isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private readonly decodedTokenSubject =
    new BehaviorSubject<UserData | null>(null);

  private authenticated = false;

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const token = localStorage.getItem(this.tokenKey);
    this.tokenSubject.next(token);
    this.isAuthenticatedSubject.next(!!token);
    this.decodedTokenSubject.next(this.getDecodedToken());
    this.authenticated = !!token;
  }

  isAuthenticated$(): Observable<boolean> {
    return this.isAuthenticatedSubject.asObservable();
  }

  get isAuthenticated(): boolean {
    return this.authenticated;
  }

  login(loginRequest: LoginRequest): Promise<{ data: { newToken: string } }> {
    return this.authService.login(loginRequest).then((response) => {
      this.setToken(response.data.newToken);
      return response;
    });
  }

  setToken(token: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.setItem(this.tokenKey, token);
    this.tokenSubject.next(token);
    this.isAuthenticatedSubject.next(true);
    this.decodedTokenSubject.next(this.getDecodedToken());
    this.authenticated = true;
  }

  logout(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.profilesKey);
    localStorage.removeItem(this.selectedProfileKey);
    this.tokenSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.decodedTokenSubject.next(null);
    this.authenticated = false;
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

  private getDecodedToken(): UserData | null {
    const token = this.tokenSubject.value;
    if (!token) {
      return null;
    }

    const decoded: Partial<UserData> = jwtDecode(token);
    return {
      userId: decoded.userId || '',
      name: decoded.name,
      email: decoded.email,
      profileId: decoded.profileId || '',
    };
  }
}
