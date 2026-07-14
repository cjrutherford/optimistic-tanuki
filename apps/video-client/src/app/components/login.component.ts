import {
  Component,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { LoginRequest, LoginType } from '@optimistic-tanuki/ui-models';
import { AuthStateService } from '../state/auth-state.service';
import {
  LoginBlockComponent,
  OAuthProviderEvent,
  OAuthService,
} from '@optimistic-tanuki/auth-ui';
import { ProfileService } from '../services/profile.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [LoginBlockComponent],
  template: `
    <section class="auth-shell" [style]="themeStyles">
      <div class="auth-story">
        <p class="eyebrow">Video Client</p>
        <h1>Step back into your channels, uploads, and watch queue.</h1>
        <p class="lede">
          Sign in to publish, subscribe, and keep your viewing flow synced with
          your video profile.
        </p>
      </div>
      <div class="login-content">
        <lib-login-block
          appId="video-platform"
          title="Sign in to Video Client"
          description="Watch, upload, schedule, and manage your channel in one place."
          heroSrc="assets/login-splash.png"
          heroAlt="Video Client studio splash"
          (submitEvent)="onSubmit($event)"
          (oauthProviderSelected)="onOAuthProvider($event)"
        ></lib-login-block>
      </div>
    </section>
  `,
  styles: [
    `
      // .auth-shell {
      //   min-height: 100vh;
      //   display: grid;
      //   grid-template-columns: minmax(0, 30rem) minmax(20rem, 34rem);
      //   gap: 3rem;
      //   align-items: center;
      //   justify-content: center;
      //   padding: 2rem 1.25rem 3rem;
      //   background: radial-gradient(
      //       circle at top left,
      //       rgba(255, 95, 61, 0.18),
      //       transparent 24rem
      //     ),
      //     radial-gradient(
      //       circle at bottom right,
      //       rgba(255, 193, 92, 0.16),
      //       transparent 26rem
      //     ),
      //     linear-gradient(180deg, #110f16 0%, #1d1823 100%);
      // }

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

      .login-content {
        max-width: 34rem;
        width: 100%;
      }

      @media (max-width: 960px) {
        // .auth-shell {
        //   grid-template-columns: 1fr;
        // }
      }
    `,
  ],
})
export class LoginComponent implements OnDestroy, OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly themeService = isPlatformBrowser(this.platformId)
    ? inject(ThemeService)
    : null;
  private readonly authStateService = inject(AuthStateService);
  private readonly http = inject(HttpClient);
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly oauthService = new OAuthService(this.http, '/api');

  themeStyles: any = {};
  private themeSub: Subscription | null = null;

  constructor() {
    this.themeSub =
      this.themeService?.themeColors$
        .pipe(filter((x) => !!x))
        .subscribe((colors) => {
          this.themeStyles = {
            backgroundColor: colors.background,
            color: colors.foreground,
          };
        }) || null;
  }

  ngOnDestroy() {
    this.themeSub?.unsubscribe();
  }

  ngOnInit(): void {
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

  async onSubmit($event: LoginType) {
    const event = $event as any;
    const loginRequest: LoginRequest = {
      email: event.email,
      password: event.password,
    };

    try {
      const response = await this.authStateService.login(loginRequest);
      this.authStateService.setToken(response.data.newToken);

      if (this.authStateService.isAuthenticated) {
        const decoded = this.authStateService.getDecodedTokenValue();

        if (decoded && decoded.profileId === '') {
          this.router.navigate(['/profile']);
          return;
        }

        await this.profileService.getAllProfiles();
        const currentProfiles = this.profileService.getCurrentUserProfiles();

        if (currentProfiles.length > 0) {
          this.profileService.selectProfile(currentProfiles[0]);
        }

        this.router.navigate(['/']);
      }
    } catch (err) {
      console.error('Login error:', err);
    }
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
