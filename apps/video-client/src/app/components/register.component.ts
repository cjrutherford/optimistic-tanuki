import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  RegisterRequest,
  RegisterSubmitType,
} from '@optimistic-tanuki/ui-models';
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
    <section class="auth-shell">
      <div class="auth-story">
        <p class="eyebrow">Video Client</p>
        <h1>Build your account before you build your channel.</h1>
        <p class="lede">
          Register to upload, schedule, and grow a channel with a profile that
          already understands the media workflow.
        </p>
      </div>
      <div class="register-content">
        <lib-register-block
          registerHeader="Create your Video Client account"
          callToAction="Start with an account, then launch your channel."
          heroSource="assets/register-splash.png"
          (submitEvent)="onSubmit($event)"
          (oauthProviderSelected)="onOAuthProvider($event)"
        ></lib-register-block>
      </div>
    </section>
  `,
  styles: [
    `
      .auth-shell {
        min-height: 100vh;
        display: grid;
        grid-template-columns: minmax(0, 30rem) minmax(20rem, 35rem);
        gap: 3rem;
        align-items: center;
        justify-content: center;
        padding: 2rem 1.25rem 3rem;
        background: radial-gradient(
            circle at top left,
            rgba(255, 95, 61, 0.18),
            transparent 24rem
          ),
          radial-gradient(
            circle at bottom right,
            rgba(255, 193, 92, 0.16),
            transparent 26rem
          ),
          linear-gradient(180deg, #110f16 0%, #1d1823 100%);
      }

      .auth-story {
        display: grid;
        gap: 1rem;
        color: #f7f0e8;
      }

      .eyebrow {
        margin: 0;
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #ff9d66;
      }

      h1 {
        margin: 0;
        font-size: clamp(2.4rem, 5vw, 4.2rem);
        line-height: 0.95;
        letter-spacing: -0.05em;
      }

      .lede {
        margin: 0;
        color: rgba(247, 240, 232, 0.8);
        line-height: 1.7;
      }

      .register-content {
        max-width: 35rem;
        width: 100%;
      }

      @media (max-width: 960px) {
        .auth-shell {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
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
