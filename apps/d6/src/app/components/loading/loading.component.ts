import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService } from '../../services/authentication.service';
import { AuthStateService } from '../../services/auth-state.service';

@Component({
  selector: 'app-loading',
  standalone: true,
  template: `
    <div class="loading-container">
      <div class="loading-content">
        <h1 class="app-title">D6</h1>
        <p class="app-tagline">Your Wellness Journey</p>
        <div class="loading-spinner"></div>
        <p class="loading-text">Loading...</p>
      </div>
    </div>
  `,
  styles: [`
    .loading-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .loading-content {
      text-align: center;
      color: white;
    }

    .app-title {
      font-size: 4rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      letter-spacing: 0.1em;
    }

    .app-tagline {
      font-size: 1.25rem;
      opacity: 0.9;
      margin-bottom: 2rem;
    }

    .loading-spinner {
      width: 50px;
      height: 50px;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      margin: 0 auto 1rem;
      animation: spin 1s linear infinite;
    }

    .loading-text {
      font-size: 0.875rem;
      opacity: 0.7;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class LoadingComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthenticationService);
  private readonly authState = inject(AuthStateService);

  constructor() {
    setTimeout(() => {
      if (this.authService.isAuthenticated()) {
        this.router.navigate(['/dashboard']);
      } else {
        this.router.navigate(['/login']);
      }
    }, 1500);
  }
}
