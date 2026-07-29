import { MessageService } from '@optimistic-tanuki/message-ui';
import { AuthStateService } from '../../auth-state.service';
import { CardComponent } from '@optimistic-tanuki/common-ui';

import { Component, OnInit, inject } from '@angular/core';
import {
  LoginBlockComponent,
  OAuthProviderEvent,
  OAuthService,
} from '@optimistic-tanuki/auth-ui';
import { LoginType } from '@optimistic-tanuki/ui-models';
import { ProfileService } from '../../profile/profile.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-login',
  imports: [LoginBlockComponent, CardComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private oauthService: OAuthService;

  constructor(
    private readonly authState: AuthStateService,
    private readonly profileService: ProfileService,
    private readonly router: Router,
    private readonly messageService: MessageService
  ) {
    this.oauthService = new OAuthService(this.http, '/api');
  }

  ngOnInit() {
    this.loadOAuthConfig();
  }

  private async loadOAuthConfig(): Promise<void> {
    try {
      const config: any = await this.http.get('/api/oauth/config').toPromise();
      if (config) {
        this.oauthService.configureProviders(config);
      }
    } catch (e) {
      console.log('OAuth config not loaded from server, using defaults');
    }
  }

  async onLoginSubmit(event: LoginType) {
    console.log('Logging in user with data:', event);
    try {
      await this.authState.login(event);
      await this.handlePostLogin();
    } catch (error) {
      console.error('Login failed:', error);
    }
  }

  async onOAuthProvider(event: OAuthProviderEvent) {
    try {
      const result = await this.oauthService.initiateOAuthLogin(
        event.provider,
        'forgeofwill'
      );

      if (result.success && (result.token || result.session)) {
        if (result.token) {
          this.authState.setToken(result.token);
        } else {
          await this.authState.restoreSession();
        }
        await this.handlePostLogin();
      } else if (result.needsRegistration && result.userData) {
        // Handle auto-registration for new OAuth users
        const names = result.userData.displayName.split(' ');
        const firstName = names[0] || '';
        const lastName = names.slice(1).join(' ') || '';

        const regResult = await this.oauthService.completeOAuthRegistration(
          result.userData.provider,
          result.userData.providerUserId,
          result.userData.email,
          firstName,
          lastName,
          ''
        );

        if (regResult.success && (regResult.token || regResult.session)) {
          if (regResult.token) {
            this.authState.setToken(regResult.token);
          } else {
            await this.authState.restoreSession();
          }
          await this.handlePostLogin();
          this.messageService.addMessage({
            content: 'Account created and login successful! Welcome!',
            type: 'success',
          });
        } else {
          this.messageService.addMessage({
            content:
              regResult.error || 'Registration failed. Please try again.',
            type: 'error',
          });
        }
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

  private async handlePostLogin(): Promise<void> {
    if (!this.authState.isAuthenticated) return;

    const decoded = this.authState.getDecodedTokenValue();
    if (decoded && (decoded as any).profileId === '') {
      await this.router.navigate(['/profile'], {
        state: {
          showProfileModal: true,
          profileMessage: 'Please create your profile to continue.',
        },
      });
      this.messageService.addMessage({
        content: 'Please create your profile to continue.',
        type: 'warning',
      });
      return;
    }

    await this.profileService.getAllProfiles();
    const currentProfiles = this.profileService.currentUserProfiles();
    if (!currentProfiles.length) {
      await this.router.navigate(['/profile'], {
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

    this.profileService.selectProfile(currentProfiles[0]);
    await this.router.navigate(['/']);
    this.messageService.addMessage({
      content: 'Login successful! Welcome back.',
      type: 'success',
    });
  }
}
