import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BusinessConfigStateService } from '../../state/business-config-state.service';
import { BusinessService } from '@optimistic-tanuki/business-data-access';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-services',
  template: `
    <div class="step-container">
      <header class="step-header">
        <h1>Services</h1>
        <p>Add the services you offer</p>
      </header>

      <div class="services-list">
        @for (service of services(); track service.id) {
        <div class="service-card">
          <div class="service-info">
            <h3>{{ service.name }}</h3>
            <p>{{ service.description }}</p>
            <div class="service-meta">
              <span>\${{ service.price }}</span>
              <span>{{ service.duration }} min</span>
              @if (service.allowOnlineBooking) {
              <span class="badge">Online Booking</span>
              }
            </div>
          </div>
          <button class="delete-btn" (click)="removeService(service.id)">
            Remove
          </button>
        </div>
        } @empty {
        <div class="empty-state">
          <p>No services added yet</p>
        </div>
        }
      </div>

      <form class="add-service-form" (ngSubmit)="addService()">
        <h2>Add New Service</h2>
        <div class="form-row">
          <div class="form-group">
            <label for="name">Service Name</label>
            <input
              type="text"
              id="name"
              [(ngModel)]="newService.name"
              name="name"
              placeholder="Consultation"
              required
            />
          </div>
          <div class="form-group">
            <label for="price">Price ($)</label>
            <input
              type="number"
              id="price"
              [(ngModel)]="newService.price"
              name="price"
              min="0"
              required
            />
          </div>
          <div class="form-group">
            <label for="duration">Duration (min)</label>
            <input
              type="number"
              id="duration"
              [(ngModel)]="newService.duration"
              name="duration"
              min="15"
              step="15"
              required
            />
          </div>
        </div>
        <div class="form-group">
          <label for="description">Description</label>
          <textarea
            id="description"
            [(ngModel)]="newService.description"
            name="description"
            placeholder="What this service includes..."
            rows="2"
          ></textarea>
        </div>
        <label class="checkbox-label">
          <input
            type="checkbox"
            [(ngModel)]="newService.allowOnlineBooking"
            name="allowOnlineBooking"
          />
          Allow online booking
        </label>
        <button type="submit" class="add-btn">Add Service</button>
      </form>

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
      .services-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-bottom: 2rem;
      }
      .service-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.25rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
      }
      .service-info h3 {
        font-weight: 500;
        margin-bottom: 0.25rem;
      }
      .service-info p {
        font-size: 0.875rem;
        color: var(--muted-foreground);
        margin-bottom: 0.5rem;
      }
      .service-meta {
        display: flex;
        gap: 0.75rem;
        font-size: 0.8125rem;
      }
      .service-meta .badge {
        background: var(--primary / 10%);
        color: var(--primary);
        padding: 0.125rem 0.5rem;
        border-radius: 999px;
      }
      .delete-btn {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--border);
        background: transparent;
        border-radius: var(--radius-md);
        cursor: pointer;
        font-size: 0.8125rem;
      }
      .delete-btn:hover {
        background: var(--destructive / 10%);
        border-color: var(--destructive);
        color: var(--destructive);
      }
      .empty-state {
        padding: 2rem;
        text-align: center;
        color: var(--muted-foreground);
        border: 1px dashed var(--border);
        border-radius: var(--radius-lg);
      }
      .add-service-form {
        padding: 1.5rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        margin-bottom: 2rem;
      }
      .add-service-form h2 {
        font-size: 1rem;
        font-weight: 600;
        margin-bottom: 1rem;
      }
      .form-row {
        display: grid;
        grid-template-columns: 1fr 100px 100px;
        gap: 1rem;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
      }
      .form-group label {
        font-size: 0.8125rem;
        font-weight: 500;
      }
      .form-group input,
      .form-group textarea {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        font-size: 0.9375rem;
      }
      .checkbox-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        margin: 1rem 0;
        cursor: pointer;
      }
      .add-btn {
        padding: 0.625rem 1rem;
        background: var(--primary);
        color: var(--primary-foreground);
        border: none;
        border-radius: var(--radius-md);
        font-weight: 500;
        cursor: pointer;
      }
      .form-actions {
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
      .form-actions button:not(.secondary) {
        background: var(--primary);
        color: var(--primary-foreground);
        border: none;
      }
    `,
  ],
})
export class ServicesComponent {
  private readonly state = inject(BusinessConfigStateService);

  readonly services = signal<BusinessService[]>(this.state.config().services);

  newService: BusinessService = {
    id: '',
    name: '',
    description: '',
    duration: 60,
    price: 0,
    allowOnlineBooking: false,
  };

  generateId(): string {
    return (
      'svc-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
    );
  }

  addService(): void {
    if (!this.newService.name || !this.newService.price) return;
    this.state.addService({ ...this.newService, id: this.generateId() });
    this.services.set(this.state.config().services);
    this.newService = {
      id: '',
      name: '',
      description: '',
      duration: 60,
      price: 0,
      allowOnlineBooking: false,
    };
  }

  removeService(id: string): void {
    this.state.removeService(id);
    this.services.set(this.state.config().services);
  }

  goBack(): void {
    this.state.prevStep();
  }

  continue(): void {
    this.state.nextStep();
  }
}
