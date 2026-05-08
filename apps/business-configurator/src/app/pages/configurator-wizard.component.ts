import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BusinessConfigStateService } from '../state/business-config-state.service';
import { BusinessInfoComponent } from './pages/business-info/business-info.component';
import { FeaturesComponent } from './pages/features/features.component';
import { ServicesComponent } from './pages/services/services.component';
import { DesignComponent } from './pages/design/design.component';
import { ReviewComponent } from './pages/review/review.component';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    BusinessInfoComponent,
    FeaturesComponent,
    ServicesComponent,
    DesignComponent,
    ReviewComponent,
  ],
  selector: 'app-configurator-wizard',
  template: `
    <div class="wizard-container">
      <header class="wizard-header">
        <h1>Business Site Builder</h1>
        <nav class="wizard-nav">
          @for (title of stepTitles; track title; let i = $index) {
            <button
              class="nav-step"
              [class.active]="state.step() === i"
              [class.completed]="state.step() > i"
              (click)="state.goToStep(i)"
            >
              <span class="step-number">{{ i + 1 }}</span>
              <span class="step-title">{{ title }}</span>
            </button>
            @if (i < stepTitles.length - 1) {
              <span class="step-connector"></span>
            }
          }
        </nav>
      </header>

      <main class="wizard-content">
        @switch (state.step()) {
          @case (0) {
            <app-business-info />
          }
          @case (1) {
            <app-features />
          }
          @case (2) {
            <app-services />
          }
          @case (3) {
            <app-design />
          }
          @case (4) {
            <app-review />
          }
        }
      </main>
    </div>
  `,
  styles: [
    `
      .wizard-container {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
      .wizard-header {
        padding: 1.5rem 2rem;
        border-bottom: 1px solid var(--border);
        background: var(--background);
      }
      .wizard-header h1 {
        font-size: 1.25rem;
        font-weight: 600;
        margin-bottom: 1.25rem;
      }
      .wizard-nav {
        display: flex;
        align-items: center;
        gap: 0;
        overflow-x: auto;
      }
      .nav-step {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        background: transparent;
        border: none;
        cursor: pointer;
        color: var(--muted-foreground);
        transition: color 0.2s;
      }
      .nav-step:hover {
        color: var(--foreground);
      }
      .nav-step.active {
        color: var(--primary);
      }
      .nav-step.completed {
        color: var(--primary);
      }
      .step-number {
        width: 1.5rem;
        height: 1.5rem;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: var(--border);
        font-size: 0.75rem;
        font-weight: 600;
      }
      .nav-step.active .step-number {
        background: var(--primary);
        color: var(--primary-foreground);
      }
      .nav-step.completed .step-number {
        background: var(--primary);
        color: var(--primary-foreground);
      }
      .step-title {
        font-size: 0.8125rem;
        font-weight: 500;
      }
      .step-connector {
        width: 1.5rem;
        height: 2px;
        background: var(--border);
        margin: 0 0.25rem;
      }
      .wizard-content {
        flex: 1;
      }
      @media (max-width: 640px) {
        .step-title {
          display: none;
        }
        .step-connector {
          width: 0.75rem;
        }
      }
    `,
  ],
})
export class ConfiguratorWizardComponent {
  private readonly state = inject(BusinessConfigStateService);

  readonly stepTitles = ['Business Info', 'Features', 'Services', 'Design', 'Review'];
}

export const CONFIGURATOR_ROUTES = [
  { path: '', component: ConfiguratorWizardComponent },
];