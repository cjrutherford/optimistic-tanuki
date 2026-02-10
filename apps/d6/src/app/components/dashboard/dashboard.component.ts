import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, CardComponent, ButtonComponent],
  template: `
    <div class="container">
      <h1 class="page-title">Dashboard</h1>

      <div class="dashboard-grid">
        <otui-card>
          <h2>Daily Four</h2>
          <p>Track your daily wellness with the Four pillars</p>
          <otui-button
            [variant]="'primary'"
            (action)="navigateTo('/daily-four')"
          >
            Start Daily Four
          </otui-button>
        </otui-card>

        <otui-card>
          <h2>Daily Six</h2>
          <p>Extended wellness tracking with mindful awareness</p>
          <otui-button
            [variant]="'primary'"
            (action)="navigateTo('/daily-six')"
          >
            Start Daily Six
          </otui-button>
        </otui-card>

        <otui-card>
          <h2>Your Progress</h2>
          <p>View your wellness journey over time</p>
          <otui-button [variant]="'secondary'" (action)="showComingSoon()">
            View Progress
          </otui-button>
        </otui-card>

        <otui-card>
          <h2>AI Assistant</h2>
          <p>Get personalized wellness suggestions</p>
          <otui-button [variant]="'secondary'" (action)="showComingSoon()">
            Chat with AI
          </otui-button>
        </otui-card>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: var(--spacing-lg, 24px);
      }

      .page-title {
        font-size: 2rem;
        font-weight: 600;
        margin-bottom: var(--spacing-lg, 24px);
        color: var(--foreground, #212121);
      }

      .dashboard-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: var(--spacing-lg, 24px);
      }

      h2 {
        font-size: 1.25rem;
        margin-bottom: var(--spacing-sm, 8px);
        color: var(--foreground, #1a1a2e);
        font-weight: 600;
      }

      p {
        color: var(--muted, #6b7280);
        margin-bottom: var(--spacing-md, 16px);
        line-height: 1.5;
      }

      otui-button {
        margin-top: auto;
      }
    `,
  ],
})
export class DashboardComponent {
  private readonly router = inject(Router);

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  showComingSoon(): void {
    alert('Coming soon!');
  }
}
