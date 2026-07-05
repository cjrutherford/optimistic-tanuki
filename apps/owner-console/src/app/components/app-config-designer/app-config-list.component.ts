import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AppConfigService } from '../../services/app-config.service';
import { AppConfiguration } from '@optimistic-tanuki/app-config-models';
import {
  IconComponent,
  ButtonComponent,
  CardComponent,
} from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'app-config-list',
  standalone: true,
  imports: [
    CommonModule,
    ButtonComponent,
    CardComponent,
    IconComponent,
    RouterModule,
  ],
  template: `
    <div class="app-config-list">
      <div class="header">
        <h1>Application Configurations</h1>
        <otui-button (action)="createNew()">
          <otui-icon name="add"></otui-icon>
          Create New Configuration
        </otui-button>
      </div>

      @if (statusMessage) {
      <div class="status-banner success" role="status">{{ statusMessage }}</div>
      } @if (loading) {
      <div class="loading">Loading configurations...</div>
      } @else if (error) {
      <div class="error status-banner" role="alert">{{ error }}</div>
      } @else { @if (configurations.length === 0) {
      <otui-card class="empty-state">
        <otui-icon class="empty-icon" name="settings-applications"></otui-icon>
        <h2>No Configurations Yet</h2>
        <p>Create your first application configuration to get started.</p>
        <otui-button (action)="createNew()">Create Configuration</otui-button>
      </otui-card>
      } @else {
      <div class="config-grid">
        @for (config of configurations; track config.id) {
        <otui-card class="config-card">
          <div class="config-header">
            <h3>{{ config.name }}</h3>
            <span
              class="status-badge"
              [class.active]="config.release?.status === 'published'"
            >
              {{ releaseStatusLabel(config) }}
            </span>
          </div>

          @if (config.description) {
          <p class="config-description">{{ config.description }}</p>
          }

          <div class="config-meta">
            @if (config.domain) {
            <div class="meta-item">
              <otui-icon name="language"></otui-icon>
              <span>{{ config.domain }}</span>
            </div>
            }
            <div class="meta-item">
              <otui-icon name="view-quilt"></otui-icon>
              <span>{{ config.landingPage.sections.length }} sections</span>
            </div>
            <div class="meta-item">
              <otui-icon name="route"></otui-icon>
              <span>{{ config.routes.length }} routes</span>
            </div>
            @if (config.release?.publishedVersion) {
            <div class="meta-item">
              <otui-icon name="history"></otui-icon>
              <span>Published v{{ config.release?.publishedVersion }}</span>
            </div>
            } @if (config.release?.previewUrl) {
            <div class="meta-item">
              <otui-icon name="language"></otui-icon>
              <a
                class="preview-link"
                [href]="config.release?.previewUrl"
                target="_blank"
                rel="noreferrer"
              >
                Preview site
              </a>
            </div>
            }
          </div>

          <div class="config-features">
            @if (config.features.social?.enabled) {
            <span class="feature-badge">Social</span>
            } @if (config.features.tasks?.enabled) {
            <span class="feature-badge">Tasks</span>
            } @if (config.features.blogging?.enabled) {
            <span class="feature-badge">Blogging</span>
            } @if (config.features.projectPlanning?.enabled) {
            <span class="feature-badge">Projects</span>
            }
          </div>

          <div class="config-actions">
            <button
              class="action-btn"
              (click)="editConfiguration(config.id)"
              title="Edit"
            >
              <otui-icon name="edit"></otui-icon>
            </button>
            <button
              class="action-btn"
              (click)="duplicateConfiguration(config)"
              title="Duplicate"
            >
              <otui-icon name="content-copy"></otui-icon>
            </button>
            <button
              class="action-btn danger"
              (click)="deleteConfiguration(config)"
              title="Delete"
            >
              <otui-icon name="delete"></otui-icon>
            </button>
          </div>
        </otui-card>
        }
      </div>
      } }
    </div>
  `,
  styles: [
    `
      .app-config-list {
        padding: 2rem;
        color: var(--foreground, #111827);
      }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
      }

      .header h1 {
        margin: 0;
        font-size: 2rem;
      }

      .loading,
      .error {
        text-align: center;
        padding: 3rem;
        font-size: 1.2rem;
      }

      .error {
        color: color-mix(in srgb, var(--danger) 82%, var(--foreground));
      }

      .status-banner {
        margin-bottom: 1.5rem;
        padding: 0.9rem 1rem;
        border-radius: 1rem;
        border: 1px solid transparent;
        text-align: left;
        font-size: 0.95rem;
        font-weight: 600;
      }

      .status-banner.success {
        background: color-mix(in srgb, var(--success, #10b981) 8%, transparent);
        border-color: color-mix(in srgb, var(--success) 18%, transparent);
        color: color-mix(in srgb, var(--success) 82%, var(--foreground));
      }

      .status-banner.error {
        background: color-mix(in srgb, var(--danger) 8%, transparent);
        border-color: color-mix(in srgb, var(--danger) 18%, transparent);
      }

      .empty-state {
        text-align: center;
        padding: 4rem 2rem;
      }

      .empty-icon {
        font-size: 4rem;
        width: 4rem;
        height: 4rem;
        color: var(--foreground-secondary, #999);
        margin-bottom: 1rem;
      }

      .empty-state h2 {
        margin: 1rem 0 0.5rem 0;
      }

      .empty-state p {
        color: var(--foreground-secondary, #666);
        margin-bottom: 2rem;
      }

      .config-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
        gap: 1.5rem;
      }

      .config-card {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .config-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .config-header h3 {
        margin: 0;
        font-size: 1.25rem;
      }

      .status-badge {
        padding: 0.25rem 0.75rem;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 600;
        background-color: color-mix(
          in srgb,
          var(--foreground, #111827) 22%,
          var(--surface, #ffffff)
        );
        color: var(--foreground, #111827);
      }

      .status-badge.active {
        background-color: var(--success, #28a745);
        color: var(--on-primary, var(--primary-foreground));
      }

      .config-description {
        color: var(--foreground-secondary, #666);
        font-size: 0.9rem;
        margin: 0;
      }

      .config-meta {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .meta-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.85rem;
        color: var(--foreground-secondary, #666);
      }

      .preview-link {
        color: inherit;
      }

      .meta-item mat-icon {
        font-size: 1rem;
        width: 1rem;
        height: 1rem;
      }

      .config-features {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .feature-badge {
        padding: 0.25rem 0.75rem;
        border-radius: 4px;
        font-size: 0.75rem;
        background-color: var(--accent, var(--primary));
        color: var(--on-primary, var(--primary-foreground));
      }

      .config-actions {
        display: flex;
        gap: 0.5rem;
        padding-top: 1rem;
        border-top: 1px solid var(--border-color, #e0e0e0);
      }

      .action-btn {
        flex: 1;
        padding: 0.5rem;
        border: 1px solid var(--border-color, #e0e0e0);
        background: var(--surface, #ffffff);
        color: var(--foreground, #111827);
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }

      .action-btn:hover {
        background-color: color-mix(
          in srgb,
          var(--foreground, #111827) 8%,
          var(--surface, #ffffff)
        );
      }

      .action-btn.danger:hover {
        background-color: var(--danger, #dc3545);
        color: var(--on-primary, var(--primary-foreground));
        border-color: var(--danger, #dc3545);
      }

      .action-btn mat-icon {
        font-size: 1.25rem;
        width: 1.25rem;
        height: 1.25rem;
      }
    `,
  ],
})
export class AppConfigListComponent implements OnInit {
  configurations: AppConfiguration[] = [];
  loading = false;
  error: string | null = null;
  statusMessage = '';

  constructor(
    private appConfigService: AppConfigService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadConfigurations();
  }

  loadConfigurations(options?: { preserveStatus?: boolean }): void {
    this.loading = true;
    this.error = null;
    if (!options?.preserveStatus) {
      this.statusMessage = '';
    }
    this.appConfigService.getConfigurations().subscribe({
      next: (configs) => {
        this.configurations = configs;
        this.loading = false;
      },
      error: (err) => {
        this.error = `Failed to load configurations: ${this.describeError(
          err
        )}`;
        this.loading = false;
      },
    });
  }

  createNew(): void {
    this.router.navigate(['/dashboard/app-config/designer']);
  }

  editConfiguration(id: string): void {
    this.router.navigate(['/dashboard/app-config/designer', id]);
  }

  releaseStatusLabel(config: AppConfiguration): string {
    const status = config.release?.status;

    if (status === 'published') {
      return 'Published';
    }

    if (status === 'changes-pending') {
      return 'Changes Pending';
    }

    if (status === 'draft') {
      return 'Draft';
    }

    return config.active ? 'Active' : 'Inactive';
  }

  duplicateConfiguration(config: AppConfiguration): void {
    this.error = null;
    this.statusMessage = '';
    const newConfig = {
      ...config,
      name: `${config.name} (Copy)`,
      domain: undefined, // Clear domain to avoid conflicts
      release: undefined,
    };
    delete (newConfig as any).id;
    delete (newConfig as any).createdAt;
    delete (newConfig as any).updatedAt;

    this.appConfigService.createConfiguration(newConfig).subscribe({
      next: () => {
        this.statusMessage =
          'Configuration duplicated. The new draft is ready in the list.';
        this.loadConfigurations({ preserveStatus: true });
      },
      error: (err) => {
        this.error = `Failed to duplicate configuration: ${this.describeError(
          err
        )}`;
      },
    });
  }

  deleteConfiguration(config: AppConfiguration): void {
    if (confirm(`Are you sure you want to delete "${config.name}"?`)) {
      this.appConfigService.deleteConfiguration(config.id).subscribe({
        next: () => {
          this.statusMessage = `"${config.name}" was removed from the configuration list.`;
          this.loadConfigurations({ preserveStatus: true });
        },
        error: (err) => {
          this.error = `Failed to delete configuration: ${this.describeError(
            err
          )}`;
        },
      });
    }
  }

  private describeError(err: unknown): string {
    if (err instanceof Error && err.message) {
      return err.message;
    }

    if (
      typeof err === 'object' &&
      err !== null &&
      'message' in err &&
      typeof err.message === 'string'
    ) {
      return err.message;
    }

    if (
      typeof err === 'object' &&
      err !== null &&
      'statusText' in err &&
      typeof err.statusText === 'string'
    ) {
      return err.statusText;
    }

    return 'Unknown error';
  }
}
