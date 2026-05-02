/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
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
      this.themeSub = this.themeService.themeColors$.pipe(filter((x) => !!x))
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
  }

  ngOnDestroy() {
    this.themeSub?.unsubscribe();
  }

  private async loadOAuthConfig(): Promise<void> {
    try {
      const config: any = await this.http.get('/api/oauth/config').toPromise();
      if (config && this.oauthService) {
        this.oauthService.configureProviders(config);
      }
    } catch (e) {
      console.log('OAuth config not loaded from server, using defaults');
    }
  }

  async onSubmit($event: LoginType) {
    const event = $event as any;
    console.log(event);
    const loginRequest: LoginRequest = {
      email: event.email,
      password: event.password,
    };
    try {
      const response = await this.authStateService.login(loginRequest);
      console.log(response);
      this.authStateService.setToken(response.data.newToken);
      if (this.authStateService.isAuthenticated) {
        const decoded = this.authStateService.getDecodedTokenValue();
        // If profileId is empty string, show only the profile creation modal
        if (decoded && decoded.profileId === '') {
          this.router.navigate(['/settings'], {
            state: {
              showProfileModal: false,
              profileMessage: 'Please create your profile to continue.',
            },
          });
          return;
        }
        // Otherwise load profiles and redirect accordingly
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
        } else {
          this.profileService.selectProfile(currentProfiles[0]);
          this.router.navigate(['/feed']);
          this.messageService.addMessage({
            content: 'Login successful! Welcome back.',
            type: 'success',
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async onOAuthProvider(event: OAuthProviderEvent) {
    try {
      const result = await this.oauthService?.initiateOAuthLogin(
        event.provider,
        'client-interface'
      );
      if (!result) {
        this.messageService.addMessage({
          content: 'OAuth login failed. Please try again.',
          type: 'error',
        });
        return;
      }

      if (result.success && result.token) {
        this.authStateService.setToken(result.token);

        if (this.authStateService.isAuthenticated) {
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
              content:
                'No profiles found. Please create a profile to continue.',
              type: 'warning',
            });
          } else {
            this.profileService.selectProfile(currentProfiles[0]);
            this.router.navigate(['/feed']);
            this.messageService.addMessage({
              content: 'Login successful! Welcome back.',
              type: 'success',
            });
          }
        }
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
}
