import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { RegisterRequest, RegisterSubmitType } from '@optimistic-tanuki/ui-models';
import { AuthenticationService } from '../services/authentication.service';
import {
  OAuthProviderEvent,
  OAuthService,
  RegisterBlockComponent,
} from '@optimistic-tanuki/auth-ui';
import { AuthStateService } from '../state/auth-state.service';
import { ProfileService } from '../services/profile.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RegisterBlockComponent],
  template: `
    <div class="register-container">
      <div class="register-content">
        <h1>Create Your Account</h1>
        <p>Join the video platform community</p>
        <lib-register-block
          (submitEvent)="onSubmit($event)"
          (oauthProviderSelected)="onOAuthProvider($event)"
        ></lib-register-block>
      </div>
    </div>
  `,
  styles: [`
    .register-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }

    .register-content {
      max-width: 500px;
      width: 100%;
    }

    h1 {
      margin: 0 0 0.5rem 0;
      font-size: 2rem;
      text-align: center;
    }

    p {
      margin: 0 0 2rem 0;
      text-align: center;
      opacity: 0.8;
    }
  `]
})
export class RegisterComponent {
  private readonly authenticationService = inject(AuthenticationService);
  private readonly authStateService = inject(AuthStateService);
  private readonly http = inject(HttpClient);
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly oauthService = new OAuthService(this.http, '/api');

  constructor() {
    void this.loadOAuthConfig();
  }

  private async loadOAuthConfig(): Promise<void> {
    try {
      const config: any = await this.http.get('/api/oauth/config').toPromise();
      if (config) {
        this.oauthService.configureProviders(config);
      }
    } catch {
      // Keep default provider config when the endpoint is unavailable.
    }
  }

  onSubmit($event: RegisterSubmitType) {
    const formValue = $event as any;
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
        console.log('Registration successful:', response);
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('Registration error:', error);
      },
    });
  }

  async onOAuthProvider(event: OAuthProviderEvent): Promise<void> {
    const result = await this.oauthService.initiateOAuthLogin(
      event.provider,
      'video-client'
    );

    if (result.success && result.token) {
      this.authStateService.setToken(result.token);
      await this.handlePostLogin();
      return;
    }

    if (result.needsRegistration && result.userData) {
      const names = result.userData.displayName.split(' ');
      const regResult = await this.oauthService.completeOAuthRegistration(
        result.userData.provider,
        result.userData.providerUserId,
        result.userData.email,
        names[0] || '',
        names.slice(1).join(' ') || '',
        ''
      );

      if (regResult.success && regResult.token) {
        this.authStateService.setToken(regResult.token);
        await this.handlePostLogin();
      }
    }
  }

  private async handlePostLogin(): Promise<void> {
    if (!this.authStateService.isAuthenticated) {
      return;
    }

    const decoded = this.authStateService.getDecodedTokenValue();

    if (decoded && decoded.profileId === '') {
      await this.router.navigate(['/profile']);
      return;
    }

    await this.profileService.getAllProfiles();
    const currentProfiles = this.profileService.getCurrentUserProfiles();

    if (currentProfiles.length > 0) {
      this.profileService.selectProfile(currentProfiles[0]);
    }

    await this.router.navigate(['/']);
  }
}
