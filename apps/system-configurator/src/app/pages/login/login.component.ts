import { Component, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CardComponent } from '@optimistic-tanuki/common-ui';
import {
  LoginBlockComponent,
  OAuthProviderEvent,
  OAuthService,
} from '@optimistic-tanuki/auth-ui';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { LoginType } from '@optimistic-tanuki/ui-models';
import { AuthenticationService } from '../../services/authentication.service';
import { AuthStateService } from '../../state/auth-state.service';
import { ProfileService } from '../../state/profile.service';
import { ReturnIntentService } from '../../state/return-intent.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [LoginBlockComponent, CardComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly authService = inject(AuthenticationService);
  private readonly authState = inject(AuthStateService);
  private readonly http = inject(HttpClient);
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly returnIntent = inject(ReturnIntentService);
  private readonly oauthService = new OAuthService(this.http, '/api');

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

  async onLoginSubmit(event: LoginType): Promise<void> {
    try {
      const response = await this.authService.login(event);
      this.authState.setToken(response.data.newToken);
      await this.profileService.getAllProfiles();

      const effectiveProfile = this.profileService.getEffectiveProfile();
      if (effectiveProfile) {
        this.profileService.selectProfile(effectiveProfile);
        const returnUrl = this.returnIntent.consume() || '/';
        this.router.navigate([returnUrl]);
        this.messageService.addMessage({
          content: 'Welcome back to HAI Computer.',
          type: 'success',
        });
        return;
      }

      this.router.navigate(['/profile-gate']);
      this.messageService.addMessage({
        content: 'Choose or create a profile to continue your system order.',
        type: 'warning',
      });
    } catch (error) {
      console.error('Login failed', error);
      this.messageService.addMessage({
        content: 'Login failed. Please verify your email and password.',
        type: 'error',
      });
    }
  }

  async onOAuthProvider(event: OAuthProviderEvent): Promise<void> {
    try {
      const result = await this.oauthService.initiateOAuthLogin(
        event.provider,
        'system-configurator'
      );

      if (result.success && result.token) {
        this.authState.setToken(result.token);
        await this.handleAuthenticatedUser();
        return;
      }

      if (result.needsRegistration) {
        this.messageService.addMessage({
          content: 'OAuth login did not complete. Please try again.',
          type: 'error',
        });
        return;
      }

      this.messageService.addMessage({
        content: 'OAuth login failed. Please try again.',
        type: 'error',
      });
    } catch (error) {
      console.error('OAuth login failed', error);
      this.messageService.addMessage({
        content: 'OAuth login failed. Please try again.',
        type: 'error',
      });
    }
  }

  private async handleAuthenticatedUser(): Promise<void> {
    await this.profileService.getAllProfiles();

    const effectiveProfile = this.profileService.getEffectiveProfile();
    if (effectiveProfile) {
      this.profileService.selectProfile(effectiveProfile);
      const returnUrl = this.returnIntent.consume() || '/';
      this.router.navigate([returnUrl]);
      this.messageService.addMessage({
        content: 'Welcome back to HAI Computer.',
        type: 'success',
      });
      return;
    }

    this.router.navigate(['/profile-gate']);
    this.messageService.addMessage({
      content: 'Choose or create a profile to continue your system order.',
      type: 'warning',
    });
  }
}
