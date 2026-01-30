import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import {
  CardComponent,
  HeadingComponent,
  ButtonComponent,
} from '@optimistic-tanuki/common-ui';
import { AppConfiguration } from '@optimistic-tanuki/app-config-models';
import { AppConfigService } from '../app-config.service';
import { AuthStateService } from '../state/auth-state.service';

@Component({
  selector: 'app-my-apps',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CardComponent,
    HeadingComponent,
    ButtonComponent,
  ],
  template: `
    <div class="my-apps-container">
      <div class="header">
        <otui-heading level="1">My Apps</otui-heading>
        <otui-button variant="primary" (action)="createNewApp()">
          <span class="button-content">
            <svg
              class="icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Create New App
          </span>
        </otui-button>
      </div>

      <div *ngIf="loading" class="loading">Loading your apps...</div>

      <div *ngIf="!loading && apps.length === 0" class="empty-state">
        <div class="empty-icon">📱</div>
        <h2>No apps yet</h2>
        <p>Create your first app to get started!</p>
        <otui-button variant="primary" (action)="createNewApp()">
          Create Your First App
        </otui-button>
      </div>

      <div *ngIf="!loading && apps.length > 0" class="apps-grid">
        <otui-card *ngFor="let app of apps" class="app-card">
          <div class="app-card-content">
            <h3>{{ app.name }}</h3>
            <p class="description">{{ app.description || 'No description' }}</p>
            <div class="app-meta">
              <span class="domain" *ngIf="app.domain">🌐 {{ app.domain }}</span>
              <span class="status" [class.active]="app.active" [class.inactive]="!app.active">
                {{ app.active ? '✓ Active' : '✗ Inactive' }}
              </span>
            </div>
            <div class="app-actions">
              <otui-button variant="secondary" size="sm" (action)="viewApp(app)">
                View
              </otui-button>
              <otui-button variant="secondary" size="sm" (action)="editApp(app)">
                Edit
              </otui-button>
              <a
                *ngIf="app.domain"
                [href]="getAppUrl(app.domain)"
                target="_blank"
                class="launch-link"
              >
                <otui-button variant="primary" size="sm">Launch</otui-button>
              </a>
            </div>
          </div>
        </otui-card>
      </div>
    </div>
  `,
  styles: [
    `
      .my-apps-container {
        padding: 2rem;
        max-width: 1400px;
        margin: 0 auto;
      }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
      }

      .button-content {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .icon {
        width: 1.25rem;
        height: 1.25rem;
      }

      .loading {
        text-align: center;
        padding: 3rem;
        color: var(--foreground, #666);
      }

      .empty-state {
        text-align: center;
        padding: 4rem 2rem;
      }

      .empty-icon {
        font-size: 4rem;
        margin-bottom: 1rem;
      }

      .empty-state h2 {
        margin-bottom: 0.5rem;
        color: var(--foreground, #333);
      }

      .empty-state p {
        color: var(--foreground, #666);
        margin-bottom: 2rem;
      }

      .apps-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 1.5rem;
      }

      .app-card {
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .app-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
      }

      .app-card-content {
        padding: 1.5rem;
      }

      .app-card-content h3 {
        margin: 0 0 0.5rem 0;
        color: var(--foreground, #333);
      }

      .description {
        color: var(--foreground, #666);
        margin: 0 0 1rem 0;
        min-height: 3rem;
      }

      .app-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-bottom: 1rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--border-color, #eee);
      }

      .domain {
        font-size: 0.875rem;
        color: var(--accent, #007bff);
      }

      .status {
        font-size: 0.875rem;
        font-weight: 600;
      }

      .status.active {
        color: var(--success, #4caf50);
      }

      .status.inactive {
        color: var(--warning, #ff9800);
      }

      .app-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .launch-link {
        text-decoration: none;
      }
    `,
  ],
})
export class MyAppsComponent implements OnInit {
  private readonly appConfigService = inject(AppConfigService);
  private readonly authState = inject(AuthStateService);
  private readonly router = inject(Router);

  apps: AppConfiguration[] = [];
  loading = false;

  ngOnInit(): void {
    this.loadApps();
  }

  loadApps(): void {
    this.loading = true;
    const profile = this.authState.getPersistedSelectedProfile();
    
    this.appConfigService.getAllAppConfigs().subscribe({
      next: (allApps) => {
        // Filter apps owned by the current user
        this.apps = allApps.filter(app => app.ownerId === profile?.id);
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load apps:', err);
        this.loading = false;
      },
    });
  }

  createNewApp(): void {
    // Navigate to app creation wizard
    this.router.navigate(['/create-app']);
  }

  viewApp(app: AppConfiguration): void {
    // Navigate to app details view
    console.log('View app:', app);
    alert(`Viewing ${app.name} (implementation coming soon)`);
  }

  editApp(app: AppConfiguration): void {
    // Navigate to app editor
    console.log('Edit app:', app);
    alert(`Editing ${app.name} (implementation coming soon)`);
  }

  getAppUrl(domain: string): string {
    // Use HTTPS for production domains, HTTP for localhost/dev
    if (domain.includes('localhost') || domain.includes('127.0.0.1') || domain.endsWith('.local')) {
      return `http://${domain}`;
    }
    return `https://${domain}`;
  }
}
