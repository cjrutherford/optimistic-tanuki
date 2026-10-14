import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { Router } from '@angular/router';
import {
  RegisterRequest,
  RegisterSubmitType,
} from '@optimistic-tanuki/ui-models';
import { AuthenticationService } from '../authentication.service';
import {
  RegisterBlockComponent,
  OAuthProviderEvent,
  OAuthService,
} from '@optimistic-tanuki/auth-ui';
import { AuthStateService } from '../state/auth-state.service';
import { ProfileService } from '../profile.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RegisterBlockComponent],
  providers: [AuthenticationService],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly authStateService = inject(AuthStateService);
  private readonly profileService = inject(ProfileService);
  errorMessage = '';
  enabledOAuthProviders: string[] = [];
  guardianResumeToken = '';
  private readonly messageService = inject(MessageService);
  private readonly platformId = inject(PLATFORM_ID);
  private oauthService: OAuthService;

  constructor(
    private readonly authenticationService: AuthenticationService,
    private readonly router: Router
  ) {
    this.oauthService = new OAuthService(this.http, '/api');
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.guardianResumeToken = new URLSearchParams(location.hash.replace(/^#/, '')).get('token') || '';
      if (this.guardianResumeToken) history.replaceState(history.state, '', `${location.pathname}${location.search}`);
    }
    this.loadOAuthConfig();
  }

  private async loadOAuthConfig(): Promise<void> {
    try {
      const config: any = await this.http.get('/api/oauth/config').toPromise();
      if (config) {
        this.oauthService.configureProviders(config);
        this.enabledOAuthProviders = this.oauthService.getEnabledProviders();
      }
    } catch (e) {
      console.log(
        'OAuth configuration unavailable; provider buttons remain hidden'
      );
    }
  }

  onSubmit($event: RegisterSubmitType) {
    const formValue = $event as any;
    this.errorMessage = '';
    const registerRequest: RegisterRequest = {
      email: formValue.email,
      password: formValue.password,
      confirm: formValue.confirmation,
      fn: formValue.firstName,
      ln: formValue.lastName,
      bio: formValue.bio,
      dateOfBirth: formValue.dateOfBirth,
      guardianEmail: formValue.guardianEmail,
      guardianResumeToken: formValue.guardianResumeToken || this.guardianResumeToken,
      guardianConsentRequest: formValue.guardianConsentRequest,
    };

    this.authenticationService.register(registerRequest).subscribe({
      next: (response: any) => {
        if (formValue.guardianConsentRequest) {
          const sent = response?.data?.request?.sent;
          this.errorMessage = sent === false
            ? "We couldn't send the permission email, and no account was created. Check the guardian address and try again."
            : 'Your guardian request is pending. No account or profile was created. A parent or guardian must record permission before you can register.';
          return;
        }
        this.router.navigate(['/login']);
      },
      error: (error) => {
        this.errorMessage =
          error?.status === 409
            ? 'This email is already registered. Please sign in or reset your password.'
            : 'Registration could not be completed. Please try again.';
      },
    });
  }

  async onOAuthProvider(event: OAuthProviderEvent) {
    try {
      const result = await this.oauthService.initiateOAuthLogin(
        event.provider,
        'client-interface',
        true,
        event.dateOfBirth,
        event.guardianResumeToken
      );

      if (result.success && (result.token || result.session)) {
        if (result.token) {
          this.authStateService.setToken(result.token);
        } else if (!(await this.authStateService.restoreSession())) {
          this.messageService.addMessage({
            content:
              'OAuth registration could not restore your session. Please try again.',
            type: 'error',
          });
          return;
        }
        await this.handlePostLogin();
      } else if (result.needsRegistration) {
        this.messageService.addMessage({
          content: 'OAuth login did not complete. Please try again.',
          type: 'error',
        });
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
          content: 'No profiles found. Please create a profile to continue.',
          type: 'warning',
        });
      } else {
        const sessionProfile = currentProfiles.find(
          (profile) => profile.id === decoded?.profileId
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
          content: 'Welcome! Registration successful.',
          type: 'success',
        });
      }
    }
  }
}
