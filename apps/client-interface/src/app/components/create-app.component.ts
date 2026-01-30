import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  CardComponent,
  HeadingComponent,
  ButtonComponent,
} from '@optimistic-tanuki/common-ui';
import {
  TextInputComponent,
  TextAreaComponent,
  CheckboxComponent,
} from '@optimistic-tanuki/form-ui';
import { CreateAppConfigDto } from '@optimistic-tanuki/app-config-models';
import { AppConfigService } from '../app-config.service';
import { AuthStateService } from '../state/auth-state.service';

@Component({
  selector: 'app-create-app',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    HeadingComponent,
    ButtonComponent,
    TextInputComponent,
    TextAreaComponent,
    CheckboxComponent,
  ],
  template: `
    <div class="create-app-container">
      <otui-card>
        <div class="wizard-header">
          <otui-heading level="1">Create Your App</otui-heading>
          <p class="subtitle">
            Build your own customizable application with authentication and features
          </p>
        </div>

        <form class="wizard-form" (ngSubmit)="createApp()">
          <div class="form-section">
            <otui-heading level="3">Basic Information</otui-heading>

            <div class="form-field">
              <lib-text-input
                label="App Name *"
                placeholder="My Awesome App"
                [(ngModel)]="formData.name"
                name="name"
                [required]="true"
              ></lib-text-input>
              <span class="field-hint">Choose a unique name for your application</span>
            </div>

            <div class="form-field">
              <lib-text-area
                label="Description"
                placeholder="Describe what your app does..."
                [(ngModel)]="formData.description"
                name="description"
              ></lib-text-area>
            </div>

            <div class="form-field">
              <lib-text-input
                label="Domain (optional)"
                placeholder="myapp.example.com"
                [(ngModel)]="formData.domain"
                name="domain"
              ></lib-text-input>
              <span class="field-hint">
                Custom domain for your app (you'll need to configure DNS)
              </span>
              <span *ngIf="formData.domain && !isDomainValid()" class="field-error">
                Please enter a valid domain name (e.g., myapp.example.com)
              </span>
            </div>
          </div>

          <div class="form-section">
            <otui-heading level="3">Features</otui-heading>

            <div class="checkbox-group">
              <div class="checkbox-item">
                <lib-checkbox
                  [value]="formData.features.auth"
                  (changeEvent)="formData.features.auth = $event"
                ></lib-checkbox>
                <label>
                  <strong>Authentication</strong>
                  <span class="feature-desc">User registration and login</span>
                </label>
              </div>

              <div class="checkbox-item">
                <lib-checkbox
                  [value]="formData.features.social"
                  (changeEvent)="formData.features.social = $event"
                ></lib-checkbox>
                <label>
                  <strong>Social Features</strong>
                  <span class="feature-desc">Posts, comments, and interactions</span>
                </label>
              </div>

              <div class="checkbox-item">
                <lib-checkbox
                  [value]="formData.features.tasks"
                  (changeEvent)="formData.features.tasks = $event"
                ></lib-checkbox>
                <label>
                  <strong>Tasks</strong>
                  <span class="feature-desc">Task management and tracking</span>
                </label>
              </div>

              <div class="checkbox-item">
                <lib-checkbox
                  [value]="formData.features.blogging"
                  (changeEvent)="formData.features.blogging = $event"
                ></lib-checkbox>
                <label>
                  <strong>Blogging</strong>
                  <span class="feature-desc">Create and publish blog posts</span>
                </label>
              </div>
            </div>
          </div>

          <div class="form-section">
            <otui-heading level="3">Permissions</otui-heading>

            <div class="checkbox-item">
              <lib-checkbox
                [value]="formData.createAppScope"
                (changeEvent)="formData.createAppScope = $event"
              ></lib-checkbox>
              <label>
                <strong>Create App Scope</strong>
                <span class="feature-desc">
                  Automatically create an isolated permission scope for this app and assign you as owner
                </span>
              </label>
            </div>
          </div>

          <div class="form-actions">
            <otui-button
              type="button"
              variant="secondary"
              (action)="cancel()"
              [disabled]="creating"
            >
              Cancel
            </otui-button>
            <otui-button
              type="submit"
              variant="primary"
              [disabled]="!isValid() || creating"
            >
              {{ creating ? 'Creating...' : 'Create App' }}
            </otui-button>
          </div>

          <div *ngIf="error" class="error-message">
            {{ error }}
          </div>
        </form>
      </otui-card>
    </div>
  `,
  styles: [
    `
      .create-app-container {
        padding: 2rem;
        max-width: 800px;
        margin: 0 auto;
      }

      .wizard-header {
        margin-bottom: 2rem;
        text-align: center;
      }

      .subtitle {
        color: var(--foreground, #666);
        margin-top: 0.5rem;
      }

      .wizard-form {
        display: flex;
        flex-direction: column;
        gap: 2rem;
      }

      .form-section {
        padding: 1.5rem;
        background: var(--background, #f9f9f9);
        border-radius: 8px;
      }

      .form-section h3 {
        margin-bottom: 1.5rem;
      }

      .form-field {
        margin-bottom: 1.5rem;
      }

      .field-hint {
        display: block;
        font-size: 0.875rem;
        color: var(--foreground, #666);
        margin-top: 0.25rem;
      }

      .field-error {
        display: block;
        font-size: 0.875rem;
        color: var(--danger, #f44336);
        margin-top: 0.25rem;
      }

      .checkbox-group {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .checkbox-item {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 1rem;
        background: var(--background, white);
        border: 1px solid var(--border-color, #ddd);
        border-radius: 6px;
      }

      .checkbox-item label {
        flex: 1;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .feature-desc {
        font-size: 0.875rem;
        color: var(--foreground, #666);
        font-weight: normal;
      }

      .form-actions {
        display: flex;
        gap: 1rem;
        justify-content: flex-end;
        padding-top: 1rem;
        border-top: 1px solid var(--border-color, #ddd);
      }

      .error-message {
        color: var(--danger, #f44336);
        padding: 1rem;
        background: rgba(244, 67, 54, 0.1);
        border: 1px solid var(--danger, #f44336);
        border-radius: 6px;
        margin-top: 1rem;
      }
    `,
  ],
})
export class CreateAppComponent {
  private readonly appConfigService = inject(AppConfigService);
  private readonly authState = inject(AuthStateService);
  private readonly router = inject(Router);

  creating = false;
  error = '';

  formData = {
    name: '',
    description: '',
    domain: '',
    createAppScope: true, // Default to true
    features: {
      auth: true, // Default to true - always enable auth
      social: false,
      tasks: false,
      blogging: false,
    },
  };

  isValid(): boolean {
    const nameValid = this.formData.name.trim().length > 0 && 
                      this.formData.name.length <= 100;
    
    // Validate domain format if provided
    if (this.formData.domain) {
      return nameValid && this.isDomainValid();
    }
    
    return nameValid;
  }

  isDomainValid(): boolean {
    if (!this.formData.domain) {
      return true; // Domain is optional
    }
    const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
    return domainRegex.test(this.formData.domain);
  }

  createApp(): void {
    if (!this.isValid()) {
      return;
    }

    this.creating = true;
    this.error = '';

    const dto: CreateAppConfigDto = {
      name: this.formData.name,
      description: this.formData.description || undefined,
      domain: this.formData.domain || undefined,
      createAppScope: this.formData.createAppScope,
      landingPage: {
        sections: [
          {
            type: 'hero',
            title: this.formData.name,
            subtitle: this.formData.description || 'Welcome to your new app!',
            content: '',
            backgroundImage: '',
            ctaText: 'Get Started',
            ctaLink: '/login',
          },
        ],
        layout: 'single-column',
      },
      routes: this.buildRoutes(),
      features: this.formData.features,
      theme: {
        primaryColor: '#007bff',
        secondaryColor: '#6c757d',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      },
      active: true,
    };

    this.appConfigService.createAppConfig(dto).subscribe({
      next: (app) => {
        console.log('App created successfully:', app);
        this.router.navigate(['/my-apps']);
      },
      error: (err) => {
        console.error('Failed to create app:', err);
        // Provide user-friendly error messages
        let errorMessage = 'Failed to create app. Please try again.';
        
        if (err.status === 409) {
          errorMessage = 'An app with this name already exists. Please choose a different name.';
        } else if (err.status === 400) {
          errorMessage = 'Invalid app configuration. Please check your inputs.';
        } else if (err.status === 500) {
          errorMessage = 'Server error occurred. Please try again later or contact support.';
        }
        
        this.error = errorMessage;
        this.creating = false;
      },
    });
  }

  buildRoutes(): any[] {
    const routes: any[] = [];

    // Always add authentication routes since we need auth
    routes.push(
      { path: '/login', label: 'Login', component: 'LoginComponent' },
      { path: '/register', label: 'Register', component: 'RegisterComponent' }
    );

    if (this.formData.features.social) {
      routes.push({ path: '/feed', label: 'Feed', component: 'FeedComponent' });
    }

    if (this.formData.features.tasks) {
      routes.push({ path: '/tasks', label: 'Tasks', component: 'TasksComponent' });
    }

    if (this.formData.features.blogging) {
      routes.push({ path: '/blog', label: 'Blog', component: 'BlogComponent' });
    }

    return routes;
  }

  cancel(): void {
    this.router.navigate(['/my-apps']);
  }
}
