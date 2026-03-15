import {
  RegisterSubmitType,
  submitTypeToRegisterRequest,
} from '@optimistic-tanuki/ui-models';

import { AuthenticationService } from '../../authentication.service';
import { AuthStateService } from '../../auth-state.service';
import { CardComponent } from '@optimistic-tanuki/common-ui';

import { Component, OnInit, inject } from '@angular/core';
import { MessageService } from '@optimistic-tanuki/message-ui';
import {
  RegisterBlockComponent,
  OAuthProviderEvent,
  OAuthService,
} from '@optimistic-tanuki/auth-ui';
import { ProfileService } from '../../profile/profile.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-register',
  imports: [RegisterBlockComponent, CardComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private oauthService: OAuthService;

  constructor(
    private readonly authService: AuthenticationService,
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
      const config: any = await this.http.get('/api/config/oauth').toPromise();
      if (config) {
        this.oauthService.configureProviders(config);
      }
    } catch (e) {
      console.log('OAuth config not loaded from server, using defaults');
    }
  }

  onSubmit(event: RegisterSubmitType) {
    console.log('Registering user with data:', event);
    const request = submitTypeToRegisterRequest(event);
    console.log('Converted request:', request);
    this.authService.register(request).subscribe({
      next: (response) => {
        console.log('Registration successful:', response);
        this.messageService.addMessage({
          content: 'Registration successful!',
          type: 'success',
        });
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('Registration failed:', error);
        this.messageService.addMessage({
          content: 'Registration failed: ' + (error.message || 'Unknown error'),
          type: 'error',
        });
      },
    });
  }

  async onOAuthProvider(event: OAuthProviderEvent) {
    try {
      const result = await this.oauthService.initiateOAuthLogin(event.provider);

      if (result.success && result.token) {
        this.authState.setToken(result.token);
        await this.handlePostLogin();
      } else if (result.needsRegistration && result.userData) {
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

        if (regResult.success && regResult.token) {
          this.authState.setToken(regResult.token);
          this.messageService.addMessage({
            content: 'Account created successfully! Welcome!',
            type: 'success',
          });
          await this.handlePostLogin();
        } else {
          this.messageService.addMessage({
            content:
              regResult.error || 'Registration failed. Please try again.',
            type: 'error',
          });
        }
      } else {
        this.messageService.addMessage({
          content:
            result.error || 'OAuth registration failed. Please try again.',
          type: 'error',
        });
      }
    } catch (err: any) {
      this.messageService.addMessage({
        content: err.message || 'OAuth registration failed. Please try again.',
        type: 'error',
      });
    }
  }

  private async handlePostLogin() {
    if (this.authState.isAuthenticated) {
      const decoded = this.authState.getDecodedTokenValue();
      if (decoded && (decoded as any).profileId === '') {
        this.router.navigate(['/profile'], {
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

      this.profileService.getAllProfiles().then(() => {
        const currentProfiles = this.profileService.currentUserProfiles();
        if (!currentProfiles.length) {
          this.router.navigate(['/profile'], {
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
          this.router.navigate(['/']);
          this.messageService.addMessage({
            content: 'Welcome! Registration successful.',
            type: 'success',
          });
        }
      });
    }
  }
}
