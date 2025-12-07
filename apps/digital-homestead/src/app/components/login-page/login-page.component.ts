import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

import { LoginBlockComponent } from '@optimistic-tanuki/auth-ui';
import { LoginType } from '@optimistic-tanuki/ui-models';
import { AuthStateService } from '../../auth-state.service';

/** Default hero image for the login page - uses existing asset */
const LOGIN_HERO_IMAGE = 'assets/digital-independence.png';

@Component({
  selector: 'dh-login-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LoginBlockComponent,
  ],
  template: `
    <div class="login-page">
      <div *ngIf="error" class="error-banner">
        {{ error }}
      </div>

      <lib-login-block
        title="Digital Homestead"
        description="Sign in to access blog editing features"
        [heroSrc]="heroImage"
        heroAlt="Digital Homestead"
        (submitEvent)="onLogin($event)"
      ></lib-login-block>

      <div class="footer-links">
        <a routerLink="/">Back to Home</a>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    }

    .error-banner {
      background: #fee;
      border: 1px solid #fcc;
      color: #c00;
      padding: 0.75rem 1.5rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      text-align: center;
      max-width: 400px;
      width: 100%;
    }

    .footer-links {
      margin-top: 1.5rem;
      text-align: center;
    }

    .footer-links a {
      color: var(--accent, #007acc);
      text-decoration: none;
    }

    .footer-links a:hover {
      text-decoration: underline;
    }
  `],
})
export class LoginPageComponent {
  private authState: AuthStateService = inject(AuthStateService);
  private router: Router = inject(Router);

  /** Hero image URL for the login block */
  heroImage = LOGIN_HERO_IMAGE;
  
  error: string | null = null;

  /**
   * Handles login submission from the login-block component.
   * The login-block component uses 'email' field naming, which maps to
   * the username field in the authentication service. The gateway
   * authentication endpoint accepts either email or username in this field.
   */
  async onLogin(credentials: LoginType): Promise<void> {
    this.error = null;

    try {
      await this.authState.login({
        username: credentials.email,
        password: credentials.password,
      });
      
      // Redirect to blog page after successful login
      this.router.navigate(['/blog']);
    } catch (err: any) {
      this.error = err?.message || 'Login failed. Please check your credentials.';
    }
  }
}
