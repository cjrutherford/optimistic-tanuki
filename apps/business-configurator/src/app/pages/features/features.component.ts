import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BusinessConfigStateService } from '../../state/business-config-state.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-features',
  template: `
    <div class="step-container">
      <header class="step-header">
        <h1>Features</h1>
        <p>Select the features you want to enable</p>
      </header>

      <div class="features-grid">
        <div class="feature-card" [class.enabled]="features.booking.enabled">
          <div class="feature-header">
            <div class="feature-toggle">
              <input
                type="checkbox"
                id="booking"
                [(ngModel)]="features.booking.enabled"
                (ngModelChange)="updateFeature('booking', $event)"
              />
              <label for="booking">Booking System</label>
            </div>
          </div>
          <p class="feature-desc">Allow clients to book appointments online</p>
          <div
            class="feature-options"
            [class.visible]="features.booking.enabled"
          >
            <label class="checkbox-label">
              <input
                type="checkbox"
                [(ngModel)]="features.booking.allowOnlinePayment"
                (ngModelChange)="updateBookingPayment($event)"
              />
              Allow online payment
            </label>
          </div>
        </div>

        <div
          class="feature-card"
          [class.enabled]="features.clientPortal.enabled"
        >
          <div class="feature-header">
            <div class="feature-toggle">
              <input
                type="checkbox"
                id="clientPortal"
                [(ngModel)]="features.clientPortal.enabled"
                (ngModelChange)="updateFeature('clientPortal', $event)"
              />
              <label for="clientPortal">Client Portal</label>
            </div>
          </div>
          <p class="feature-desc">
            Login portal for clients to view sessions and progress
          </p>
        </div>

        <div
          class="feature-card"
          [class.enabled]="features.clientTasks.enabled"
        >
          <div class="feature-header">
            <div class="feature-toggle">
              <input
                type="checkbox"
                id="clientTasks"
                [(ngModel)]="features.clientTasks.enabled"
                (ngModelChange)="updateFeature('clientTasks', $event)"
              />
              <label for="clientTasks">Client Tasks</label>
            </div>
          </div>
          <p class="feature-desc">Assign tasks for clients to complete</p>
          <div
            class="feature-options"
            [class.visible]="features.clientTasks.enabled"
          >
            <label class="checkbox-label">
              <input
                type="checkbox"
                [(ngModel)]="features.clientTasks.allowClientCompletion"
                (ngModelChange)="updateClientTaskCompletion($event)"
              />
              Allow clients to mark tasks complete
            </label>
          </div>
        </div>

        <div class="feature-card" [class.enabled]="features.invoices.enabled">
          <div class="feature-header">
            <div class="feature-toggle">
              <input
                type="checkbox"
                id="invoices"
                [(ngModel)]="features.invoices.enabled"
                (ngModelChange)="updateFeature('invoices', $event)"
              />
              <label for="invoices">Invoices</label>
            </div>
          </div>
          <p class="feature-desc">Generate and track invoices for services</p>
        </div>

        <div
          class="feature-card"
          [class.enabled]="features.testimonials.enabled"
        >
          <div class="feature-header">
            <div class="feature-toggle">
              <input
                type="checkbox"
                id="testimonials"
                [(ngModel)]="features.testimonials.enabled"
                (ngModelChange)="updateFeature('testimonials', $event)"
              />
              <label for="testimonials">Testimonials</label>
            </div>
          </div>
          <p class="feature-desc">Show client testimonials on your site</p>
        </div>
      </div>

      <div class="form-actions">
        <button class="secondary" (click)="goBack()">Back</button>
        <button (click)="continue()">Continue</button>
      </div>
    </div>
  `,
  styles: [
    `
      .step-container {
        max-width: 700px;
        margin: 0 auto;
        padding: 2rem;
      }
      .step-header {
        margin-bottom: 2rem;
      }
      .step-header h1 {
        font-size: 1.75rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
      }
      .step-header p {
        color: var(--muted-foreground);
      }
      .features-grid {
        display: grid;
        gap: 1rem;
      }
      .feature-card {
        padding: 1.25rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        transition: border-color 0.2s, background 0.2s;
      }
      .feature-card.enabled {
        border-color: var(--primary);
        background: var(--primary / 5%);
      }
      .feature-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .feature-toggle {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .feature-toggle input[type='checkbox'] {
        width: 1.25rem;
        height: 1.25rem;
        accent-color: var(--primary);
      }
      .feature-toggle label {
        font-weight: 500;
        font-size: 1rem;
      }
      .feature-desc {
        margin-top: 0.5rem;
        color: var(--muted-foreground);
        font-size: 0.875rem;
      }
      .feature-options {
        margin-top: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px solid var(--border);
        opacity: 0;
        max-height: 0;
        overflow: hidden;
        transition: opacity 0.2s, max-height 0.2s;
      }
      .feature-options.visible {
        opacity: 1;
        max-height: 100px;
      }
      .checkbox-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        cursor: pointer;
      }
      .form-actions {
        margin-top: 2rem;
        display: flex;
        gap: 0.75rem;
        justify-content: flex-end;
      }
      .form-actions button {
        padding: 0.75rem 1.5rem;
        border-radius: var(--radius-md);
        font-weight: 500;
        cursor: pointer;
        border: 1px solid var(--border);
        background: var(--background);
      }
      .form-actions button.primary,
      .form-actions button:not(.secondary) {
        background: var(--primary);
        color: var(--primary-foreground);
        border: none;
      }
    `,
  ],
})
export class FeaturesComponent {
  private readonly state = inject(BusinessConfigStateService);

  readonly features = this.state.config().features;

  updateFeature(feature: string, enabled: boolean): void {
    this.state.updateFeatures({ [feature]: { enabled } });
  }

  updateBookingPayment(enabled: boolean): void {
    this.state.updateFeatures({
      booking: {
        enabled: this.features.booking.enabled,
        allowOnlinePayment: enabled,
      },
    });
  }

  updateClientTaskCompletion(enabled: boolean): void {
    this.state.updateFeatures({
      clientTasks: {
        enabled: this.features.clientTasks.enabled,
        allowClientCompletion: enabled,
      },
    });
  }

  goBack(): void {
    this.state.prevStep();
  }

  continue(): void {
    this.state.nextStep();
  }
}
