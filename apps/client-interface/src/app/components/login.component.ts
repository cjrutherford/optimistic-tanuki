import {
  Component,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { LoginRequest } from '@optimistic-tanuki/ui-models';
import { AuthStateService } from '../state/auth-state.service';

import { Subscription, filter } from 'rxjs';
import { MessageService } from '@optimistic-tanuki/message-ui';
import {
  LoginBlockComponent,
  OAuthProviderEvent,
  OAuthService,
} from '@optimistic-tanuki/auth-ui';
import { LoginType } from '@optimistic-tanuki/ui-models';
import { ProfileService } from '../profile.service';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [LoginBlockComponent],
})
export class LoginComponent implements OnDestroy, OnInit {
  private readonly messageService = inject(MessageService);
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  errorMessage = '';
  enabledOAuthProviders: string[] = [];
  themeSub?: Subscription;
  themeStyles!: {
    backgroundColor: string;
    color: string;
    border: string;
  };
  private readonly themeService: ThemeService = inject(ThemeService);
  private readonly authStateService: AuthStateService =
    inject(AuthStateService);
  private readonly router: Router = inject(Router);
  private readonly profileService = inject(ProfileService);
  private oauthService?: OAuthService;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.themeSub = this.themeService.themeColors$
        .pipe(filter((x) => !!x))
        .subscribe((colors) => {
          this.themeStyles = {
            backgroundColor: colors.background,
            color: colors.foreground,
            border: `1px solid ${colors.accent}`,
          };
        });
      this.oauthService = new OAuthService(this.http, '/api') as OAuthService;
    }
  }

  ngOnInit() {
    this.loadOAuthConfig();
    void this.restoreExistingSession();
  }

  ngOnDestroy() {
    this.themeSub?.unsubscribe();
  }

  private async loadOAuthConfig(): Promise<void> {
    try {
      const config: any = await this.http.get('/api/oauth/config').toPromise();
      if (config && this.oauthService) {
        this.oauthService.configureProviders(config);
        this.enabledOAuthProviders = this.oauthService.getEnabledProviders();
      }
    } catch (e) {
      console.log(
        'OAuth configuration unavailable; provider buttons remain hidden'
      );
    }
  }

  async onSubmit($event: LoginType) {
    const event = $event as any;
    this.errorMessage = '';
    const loginRequest: LoginRequest = {
      email: event.email,
      password: event.password,
      dateOfBirth: event.dateOfBirth,
      guardianEmail: event.guardianEmail,
    };
    try {
      const response = await this.authStateService.login(loginRequest);
      if (response?.data?.['guardianConsentPending']) {
        this.errorMessage =
          response?.data?.['guardianEmailSent'] === true
            ? 'A parent or guardian permission request was sent. Sign in again after they approve it.'
            : 'The guardian permission email could not be sent. Check the guardian address and try again.';
        return;
      }

      if (this.authStateService.isAuthenticated) {
        await this.completeAuthenticatedLogin();
      }
    } catch (err: any) {
      const detail = err?.error?.message || err?.message || '';
      this.errorMessage =
        err?.status === 401
          ? 'Invalid email or password. Please try again.'
          : String(detail).includes('AGE_CHECK_REQUIRED')
          ? 'For this newly registered account, enter your date of birth to continue.'
          : String(detail).includes('GUARDIAN_EMAIL_REQUIRED')
          ? 'A parent or guardian email is required to request permission.'
          : String(detail).includes('AGE_UNDER_13')
          ? 'Sign in is unavailable under age 13.'
          : 'Sign-in could not be completed. Please try again.';
    }
  }

  async onOAuthProvider(event: OAuthProviderEvent) {
    try {
      const result = await this.oauthService?.initiateOAuthLogin(
        event.provider,
        'client-interface',
        true,
        event.dateOfBirth
      );
      if (!result) {
        this.messageService.addMessage({
          content: 'OAuth login failed. Please try again.',
          type: 'error',
        });
        return;
      }

      if (result.success && (result.token || result.session)) {
        if (result.token) {
          this.authStateService.setToken(result.token);
        } else if (!(await this.authStateService.restoreSession())) {
          this.messageService.addMessage({
            content:
              'OAuth login could not restore your session. Please try again.',
            type: 'error',
          });
          return;
        }

        await this.completeAuthenticatedLogin();
      } else if (result.needsRegistration) {
        this.messageService.addMessage({
          content: 'OAuth login did not complete. Please try again.',
          type: 'error',
        });
      } else {
        this.messageService.addMessage({
          content: result.error || 'OAuth login failed. Please try again.',
          type: 'error',
        });
      }
    } catch (err: any) {
      this.messageService.addMessage({
        content: err.message || 'OAuth login failed. Please try again.',
        type: 'error',
      });
    }
  }

  private async restoreExistingSession(): Promise<void> {
    if (await this.authStateService.restoreSession()) {
      await this.completeAuthenticatedLogin();
    }
  }

  private async completeAuthenticatedLogin(): Promise<void> {
    if (!this.authStateService.isAuthenticated) {
      return;
    }

    const decoded = this.authStateService.getDecodedTokenValue();
    if (decoded && decoded.profileId === '') {
      this.router.navigate(['/settings'], {
        state: {
          showProfileModal: false,
          profileMessage: 'Please create your profile to continue.',
        },
      });
      return;
    }

    await this.profileService.getAllProfiles();
    const currentProfiles = this.profileService.getCurrentUserProfiles();
    if (!currentProfiles.length) {
      this.router.navigate(['/settings'], {
        state: {
          showProfileModal: true,
          profileMessage:
            'No profiles found. Please create a profile to continue.',
        },
      });
      this.messageService.addMessage({
        content: 'No profiles found. Please create a profile to continue.',
        type: 'warning',
      });
      return;
    }

    const sessionProfileId = decoded?.profileId;
    const sessionProfile = currentProfiles.find(
      (profile) => profile.id === sessionProfileId
    );
    if (!sessionProfile) {
      this.errorMessage =
        'Your active profile could not be loaded. Please sign in again.';
      this.messageService.addMessage({
        content: this.errorMessage,
        type: 'error',
      });
      return;
    }

    this.profileService.selectProfile(sessionProfile);
    this.router.navigate(['/feed']);
    this.messageService.addMessage({
      content: 'Login successful! Welcome back.',
      type: 'success',
    });
  }
}
