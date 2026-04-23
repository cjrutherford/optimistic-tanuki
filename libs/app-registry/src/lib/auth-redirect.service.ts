import { Inject, Injectable, InjectionToken } from '@angular/core';
import { NavigationService } from './navigation.service';
import { SsoSessionService } from './sso-session.service';

export const APP_REGISTRY_AUTH_APP_ID = new InjectionToken<string>(
  'APP_REGISTRY_AUTH_APP_ID',
  {
    providedIn: 'root',
    factory: () => 'auth',
  }
);

@Injectable({ providedIn: 'root' })
export class AuthRedirectService {
  constructor(
    private readonly session: SsoSessionService,
    private readonly navigation: NavigationService,
    @Inject(APP_REGISTRY_AUTH_APP_ID) private readonly authAppId = 'auth'
  ) {}

  redirectToLogin(): void {
    this.session.clearSession();
    this.navigation.navigate(this.authAppId, '/login', {
      includeReturn: true,
    });
  }
}
