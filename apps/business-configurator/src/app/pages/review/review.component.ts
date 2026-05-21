import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BusinessConfigStateService } from '../../state/business-config-state.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-review',
  template: `
    <div class="step-container">
      <header class="step-header">
        <h1>Review</h1>
        <p>Review your business site configuration</p>
      </header>

      <div class="review-sections">
        <section class="review-section">
          <h2>Business Info</h2>
          <div class="review-item">
            <span class="label">Type</span>
            <span class="value">{{ config.businessType }}</span>
          </div>
          <div class="review-item">
            <span class="label">Name</span>
            <span class="value">{{ config.brand.businessName }}</span>
          </div>
          <div class="review-item">
            <span class="label">Monogram</span>
            <span class="value">{{ config.brand.monogram }}</span>
          </div>
          <div class="review-item">
            <span class="label">Owner</span>
            <span class="value">{{ config.brand.ownerName }}</span>
          </div>
          <div class="review-item">
            <span class="label">Tagline</span>
            <span class="value">{{ config.brand.tagline }}</span>
          </div>
          <div class="review-item">
            <span class="label">Contact</span>
            <span class="value"
              >{{ config.contact.email }} | {{ config.contact.phone }}</span
            >
          </div>
        </section>

        <section class="review-section">
          <h2>Features</h2>
          <div class="features-list">
            <span [class.enabled]="config.features.booking.enabled"
              >Booking</span
            >
            <span [class.enabled]="config.features.clientPortal.enabled"
              >Client Portal</span
            >
            <span [class.enabled]="config.features.clientTasks.enabled"
              >Client Tasks</span
            >
            <span [class.enabled]="config.features.invoices.enabled"
              >Invoices</span
            >
            <span [class.enabled]="config.features.testimonials.enabled"
              >Testimonials</span
            >
          </div>
        </section>

        <section class="review-section">
          <h2>Services ({{ config.services.length }})</h2>
          @for (service of config.services; track service.id) {
          <div class="service-item">
            <span>{{ service.name }}</span>
            <span>\${{ service.price }} / {{ service.duration }}min</span>
          </div>
          } @empty {
          <p class="empty">No services configured</p>
          }
        </section>

        <section class="review-section">
          <h2>Design</h2>
          <div class="review-item">
            <span class="label">Theme</span>
            <span class="value">{{ config.theme.mode }}</span>
          </div>
          <div class="review-item">
            <span class="label">Primary Color</span>
            <span class="value">
              <span
                class="color-dot"
                [style.background]="config.theme.primaryColor"
              ></span>
              {{ config.theme.primaryColor }}
            </span>
          </div>
          <div class="review-item">
            <span class="label">Personality</span>
            <span class="value">{{ config.theme.personalityId }}</span>
          </div>
          <div class="review-item">
            <span class="label">Layout</span>
            <span class="value">{{ config.landingPage.layout }}</span>
          </div>
        </section>
      </div>

      <div class="form-actions">
        <button class="secondary" (click)="goBack()">Back</button>
        <button class="primary" (click)="publish()">Publish Site</button>
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
      .review-sections {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }
      .review-section {
        padding: 1.25rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
      }
      .review-section h2 {
        font-size: 1rem;
        font-weight: 600;
        margin-bottom: 1rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid var(--border);
      }
      .review-item {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem 0;
      }
      .review-item .label {
        color: var(--muted-foreground);
      }
      .review-item .value {
        font-weight: 500;
      }
      .features-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .features-list span {
        padding: 0.25rem 0.75rem;
        border-radius: 999px;
        font-size: 0.8125rem;
        background: var(--border);
        color: var(--muted-foreground);
      }
      .features-list span.enabled {
        background: var(--primary / 15%);
        color: var(--primary);
      }
      .service-item {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--border);
      }
      .service-item:last-child {
        border-bottom: none;
      }
      .empty {
        color: var(--muted-foreground);
        font-size: 0.875rem;
      }
      .color-dot {
        display: inline-block;
        width: 1rem;
        height: 1rem;
        border-radius: 50%;
        margin-right: 0.5rem;
        vertical-align: middle;
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
      .form-actions button.primary {
        background: var(--primary);
        color: var(--primary-foreground);
        border: none;
      }
    `,
  ],
})
export class ReviewComponent {
  private readonly state = inject(BusinessConfigStateService);

  get config() {
    return this.state.config();
  }

  goBack(): void {
    this.state.prevStep();
  }

  publish(): void {
    console.log('Publishing site config:', this.config);
    alert('Site configuration published! (demo - API integration needed)');
  }
}
