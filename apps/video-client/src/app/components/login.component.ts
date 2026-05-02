import { Component, inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
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
    <div class="login-container" [style]="themeStyles">
      <div class="login-content">
        <h1>Welcome to Video Platform</h1>
        <p>Sign in to watch, upload, and interact with videos</p>
        <lib-login-block
          (submitEvent)="onSubmit($event)"
          (oauthProviderSelected)="onOAuthProvider($event)"
        ></lib-login-block>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }

    .login-content {
      max-width: 400px;
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
export class LoginComponent implements OnDestroy, OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly themeService = isPlatformBrowser(this.platformId) ? inject(ThemeService) : null;
  private readonly authStateService = inject(AuthStateService);
  private readonly http = inject(HttpClient);
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly oauthService = new OAuthService(this.http, '/api');
  
  themeStyles: any = {};
  private themeSub: Subscription | null = null;

  constructor() {
    this.themeSub = this.themeService?.themeColors$
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
