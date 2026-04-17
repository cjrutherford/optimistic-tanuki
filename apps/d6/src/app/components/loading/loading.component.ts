import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SpinnerComponent } from '@optimistic-tanuki/common-ui';
import { AuthenticationService } from '../../services/authentication.service';
import { AuthStateService } from '../../services/auth-state.service';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule, SpinnerComponent],
  template: `
    <div class="loading-container">
      <div class="loading-content">
        <h1 class="app-title">D6</h1>
        <p class="app-tagline">Your Wellness Journey</p>
        <otui-spinner [styleType]="'circle'" class="large-spinner">
        </otui-spinner>
        <p class="loading-text">Loading...</p>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .loading-container {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background: var(--background, #ffffff);
      }

      .loading-content {
        text-align: center;
        color: var(--foreground, #212121);
      }

      .app-title {
        font-size: 4rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
        letter-spacing: 0.1em;
        background: linear-gradient(
          135deg,
          var(--primary, #4f46e5) 0%,
          var(--accent, #764ba2) 100%
        );
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .app-tagline {
        font-size: 1.25rem;
        opacity: 0.8;
        margin-bottom: 2rem;
        color: var(--muted, #6b7280);
      }

      .loading-text {
        font-size: 0.875rem;
        opacity: 0.6;
        margin-top: 1rem;
        color: var(--muted, #6b7280);
      }

      .large-spinner {
        --spinner-size: 64px;
      }

      otui-spinner {
        margin: 0 auto;
        --spinner-color: var(--primary, #4f46e5);
      }
    `,
  ],
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
