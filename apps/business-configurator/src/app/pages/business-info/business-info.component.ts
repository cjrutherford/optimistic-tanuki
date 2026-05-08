import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BusinessConfigStateService } from '../../state/business-config-state.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-business-info',
  template: `
    <div class="step-container">
      <header class="step-header">
        <h1>Business Info</h1>
        <p>Tell us about your business</p>
      </header>

      <form class="step-form" (ngSubmit)="onSubmit()">
        <div class="form-group">
          <label for="businessType">Business Type</label>
          <select
            id="businessType"
            [ngModel]="state.config().businessType"
            name="businessType"
            (ngModelChange)="onBusinessTypeChange($event)"
          >
            <option value="fitness">Fitness / Training</option>
            <option value="consulting">Consulting</option>
            <option value="coaching">Coaching</option>
            <option value="wellness">Wellness</option>
            <option value="general">General</option>
          </select>
        </div>

        <div class="form-group">
          <label for="businessName">Business Name</label>
          <input
            type="text"
            id="businessName"
            name="businessName"
            [(ngModel)]="brand.businessName"
            placeholder="My Business"
            required
          />
        </div>

        <div class="form-group">
          <label for="monogram">Monogram (2-3 letters)</label>
          <input
            type="text"
            id="monogram"
            name="monogram"
            [(ngModel)]="brand.monogram"
            placeholder="MB"
            maxlength="3"
            required
          />
        </div>

        <div class="form-group">
          <label for="ownerName">Your Name</label>
          <input
            type="text"
            id="ownerName"
            name="ownerName"
            [(ngModel)]="brand.ownerName"
            placeholder="Your Name"
          />
        </div>

        <div class="form-group">
          <label for="tagline">Tagline</label>
          <input
            type="text"
            id="tagline"
            name="tagline"
            [(ngModel)]="brand.tagline"
            placeholder="Professional services for your needs"
          />
        </div>

        <div class="form-group">
          <label for="intro">Short Intro</label>
          <textarea
            id="intro"
            name="intro"
            [(ngModel)]="brand.intro"
            placeholder="Brief description of your business"
            rows="3"
          ></textarea>
        </div>

        <div class="form-group">
          <label for="longBio">Full Bio</label>
          <textarea
            id="longBio"
            name="longBio"
            [(ngModel)]="brand.longBio"
            placeholder="Detailed description of your business"
            rows="5"
          ></textarea>
        </div>

        <div class="form-group">
          <label for="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            [(ngModel)]="contact.email"
            placeholder="hello@business.com"
          />
        </div>

        <div class="form-group">
          <label for="phone">Phone</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            [(ngModel)]="contact.phone"
            placeholder="(555) 000-0000"
          />
        </div>

        <div class="form-group">
          <label for="location">Location</label>
          <input
            type="text"
            id="location"
            name="location"
            [(ngModel)]="contact.location"
            placeholder="City, State"
          />
        </div>

        <div class="form-actions">
          <button type="submit" [disabled]="!canProceed()">Continue</button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .step-container {
        max-width: 600px;
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
      .step-form {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
      }
      .form-group label {
        font-size: 0.875rem;
        font-weight: 500;
      }
      .form-group input,
      .form-group select,
      .form-group textarea {
        padding: 0.625rem 0.875rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        font-size: 0.9375rem;
        background: var(--background);
        color: var(--foreground);
      }
      .form-group input:focus,
      .form-group select:focus,
      .form-group textarea:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 2px var(--primary / 10%);
      }
      .form-group textarea {
        resize: vertical;
        min-height: 80px;
      }
      .form-actions {
        margin-top: 1rem;
        display: flex;
        gap: 0.75rem;
      }
      .form-actions button {
        padding: 0.75rem 1.5rem;
        border-radius: var(--radius-md);
        font-weight: 500;
        cursor: pointer;
        background: var(--primary);
        color: var(--primary-foreground);
        border: none;
      }
      .form-actions button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `,
  ],
})
export class BusinessInfoComponent {
  private readonly state = inject(BusinessConfigStateService);
  private readonly router = inject(Router);

  readonly brand = {
    businessName: this.state.config().brand.businessName,
    monogram: this.state.config().brand.monogram,
    ownerName: this.state.config().brand.ownerName,
    tagline: this.state.config().brand.tagline,
    intro: this.state.config().brand.intro,
    longBio: this.state.config().brand.longBio,
  };

  readonly contact = {
    email: this.state.config().contact.email,
    phone: this.state.config().contact.phone,
    location: this.state.config().contact.location,
  };

  onBusinessTypeChange(type: string): void {
    this.state.updateBusinessType(type as any);
  }

  onSubmit(): void {
    this.state.updateBrand(this.brand);
    this.state.updateContact(this.contact);
    this.state.nextStep();
  }

  canProceed(): boolean {
    return !!this.brand.businessName && !!this.brand.monogram;
  }
}