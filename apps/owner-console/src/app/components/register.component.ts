import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import {
  RegisterBlockComponent,
  OAuthProviderEvent,
  OAuthService,
} from '@optimistic-tanuki/auth-ui';
import { AuthService } from '../services/auth.service';
import { RegisterSubmitType } from '@optimistic-tanuki/ui-models';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RouterModule, RegisterBlockComponent],
  template: `
    <div class="register-container">
      <lib-register-block
        registerHeader="Owner Console Registration"
        callToAction="Create an owner account with full administrative access to all apps"
        registerButtonText="Register as Owner"
        [heroSource]="
          'https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=2070'
        "
        (submitEvent)="onRegister($event)"
        (oauthProviderSelected)="onOAuthProvider($event)"
      ></lib-register-block>
      <div class="login-link">
        <a routerLink="/login">Already have an account? Login</a>
      </div>
      <div *ngIf="error" class="error-message">{{ error }}</div>
      <div *ngIf="success" class="success-message">{{ success }}</div>
    </div>
  `,
  styles: [
    `
      .register-container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        padding: 2rem;
      }

      lib-register-block {
        width: 100%;
        max-width: 800px;
      }

      .error-message {
        color: #f44336;
        margin-top: 1rem;
        font-size: 0.875rem;
        text-align: center;
      }

      .success-message {
        color: #4caf50;
        margin-top: 1rem;
        font-size: 0.875rem;
        text-align: center;
      }

      .login-link {
        margin-top: 1rem;
        text-align: center;
      }

      .login-link a {
        color: #667eea;
        text-decoration: none;
      }

      .login-link a:hover {
        text-decoration: underline;
      }
    `,
  ],
})
export class RegisterComponent implements OnInit {
  error = '';
  success = '';
  private oauthService: OAuthService;
  private http = inject(HttpClient);

  constructor(private authService: AuthService, private router: Router) {
    this.oauthService = new OAuthService(this.http, '/api');
  }

  ngOnInit(): void {
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

  onRegister(registerData: RegisterSubmitType): void {
    this.error = '';
    this.success = '';

    this.authService
      .register(
        registerData.email,
        registerData.firstName,
        registerData.lastName,
        registerData.password,
        registerData.confirmation,
        registerData.bio
      )
      .subscribe({
        next: () => {
          this.success = 'Registration successful! Redirecting to dashboard...';
          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 2000);
        },
        error: (err) => {
          this.error =
            err.error?.message || 'Registration failed. Please try again.';
        },
      });
  }

  async onOAuthProvider(event: OAuthProviderEvent): Promise<void> {
    this.error = '';
    this.success = '';

    try {
      const result = await this.oauthService.initiateOAuthLogin(event.provider);

      if (result.success && result.token) {
        this.authService.setToken(result.token);
        this.success = 'Registration and login successful! Redirecting...';
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 1500);
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

        if (regResult.success && regResult.token) {
          this.authService.setToken(regResult.token);
          this.success = 'Registration and login successful! Redirecting...';
          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 1500);
        } else {
          this.error =
            regResult.error || 'Registration failed. Please try again.';
        }
      } else {
        this.error =
          result.error || 'OAuth registration failed. Please try again.';
      }
    } catch (err: any) {
      this.error =
        err.message || 'OAuth registration failed. Please try again.';
    }
  }
}
