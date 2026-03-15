/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';

import {
  ReactiveFormsModule,
  FormGroup,
  FormBuilder,
  Validators,
} from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
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
  imports: [
    ReactiveFormsModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    RegisterBlockComponent,
  ],
  providers: [AuthenticationService],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly authStateService = inject(AuthStateService);
  private readonly profileService = inject(ProfileService);
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

  // Custom validator to check if password and confirmPassword match
  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  onSubmit($event: RegisterSubmitType) {
    const formValue = $event as any;
    console.log('Form submitted:', formValue);
    const registerRequest: RegisterRequest = {
      email: formValue.email,
      password: formValue.password,
      confirm: formValue.confirmation,
      fn: formValue.firstName,
      ln: formValue.lastName,
      bio: formValue.bio,
    };

    this.authenticationService.register(registerRequest).subscribe({
      next: (response) => {
        console.log(response);
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error(error);
      },
    });
  }

  async onOAuthProvider(event: OAuthProviderEvent) {
    try {
      const result = await this.oauthService.initiateOAuthLogin(event.provider);

      if (result.success && result.token) {
        this.authStateService.setToken(result.token);
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
          this.authStateService.setToken(regResult.token);
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
        this.profileService.selectProfile(currentProfiles[0]);
        this.router.navigate(['/feed']);
        this.messageService.addMessage({
          content: 'Welcome! Registration successful.',
          type: 'success',
        });
      }
    }
  }
}
