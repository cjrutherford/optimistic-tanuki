import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AppConfigService } from '../../services/app-config.service';
import { AppConfiguration } from '@optimistic-tanuki/app-config-models';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-config-list',
  standalone: true,
  imports: [CommonModule, ButtonComponent, CardComponent, MatIconModule, RouterModule],
  template: `
    <div class="app-config-list">
      <div class="header">
        <h1>Application Configurations</h1>
        <otui-button (action)="createNew()">
          <mat-icon>add</mat-icon>
          Create New Configuration
        </otui-button>
      </div>

      @if (loading) {
        <div class="loading">Loading configurations...</div>
      } @else if (error) {
        <div class="error">{{ error }}</div>
      } @else {
        @if (configurations.length === 0) {
          <otui-card class="empty-state">
            <mat-icon class="empty-icon">settings_applications</mat-icon>
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
                  <span class="status-badge" [class.active]="config.active">
                    {{ config.active ? 'Active' : 'Inactive' }}
                  </span>
                </div>
                
                @if (config.description) {
                  <p class="config-description">{{ config.description }}</p>
                }
                
                <div class="config-meta">
                  @if (config.domain) {
                    <div class="meta-item">
                      <mat-icon>language</mat-icon>
                      <span>{{ config.domain }}</span>
                    </div>
                  }
                  <div class="meta-item">
                    <mat-icon>view_quilt</mat-icon>
                    <span>{{ config.landingPage.sections.length }} sections</span>
                  </div>
                  <div class="meta-item">
                    <mat-icon>route</mat-icon>
                    <span>{{ config.routes.length }} routes</span>
                  </div>
                </div>

                <div class="config-features">
                  @if (config.features.social?.enabled) {
                    <span class="feature-badge">Social</span>
                  }
                  @if (config.features.tasks?.enabled) {
                    <span class="feature-badge">Tasks</span>
                  }
                  @if (config.features.blogging?.enabled) {
                    <span class="feature-badge">Blogging</span>
                  }
                  @if (config.features.projectPlanning?.enabled) {
                    <span class="feature-badge">Projects</span>
                  }
                </div>

                <div class="config-actions">
                  <button class="action-btn" (click)="editConfiguration(config.id)" title="Edit">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button class="action-btn" (click)="duplicateConfiguration(config)" title="Duplicate">
                    <mat-icon>content_copy</mat-icon>
                  </button>
                  <button class="action-btn danger" (click)="deleteConfiguration(config)" title="Delete">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </otui-card>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .app-config-list {
      padding: 2rem;
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

    .loading, .error {
      text-align: center;
      padding: 3rem;
      font-size: 1.2rem;
    }

    .error {
      color: #dc3545;
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
    }

    .empty-icon {
      font-size: 4rem;
      width: 4rem;
      height: 4rem;
      color: #999;
      margin-bottom: 1rem;
    }

    .empty-state h2 {
      margin: 1rem 0 0.5rem 0;
    }

    .empty-state p {
      color: #666;
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
      background-color: #6c757d;
      color: white;
    }

    .status-badge.active {
      background-color: #28a745;
    }

    .config-description {
      color: #666;
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
      color: #666;
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
      background-color: #007bff;
      color: white;
    }

    .config-actions {
      display: flex;
      gap: 0.5rem;
      padding-top: 1rem;
      border-top: 1px solid #e0e0e0;
    }

    .action-btn {
      flex: 1;
      padding: 0.5rem;
      border: 1px solid #e0e0e0;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .action-btn:hover {
      background-color: #f0f0f0;
    }

    .action-btn.danger:hover {
      background-color: #dc3545;
      color: white;
      border-color: #dc3545;
    }

    .action-btn mat-icon {
      font-size: 1.25rem;
      width: 1.25rem;
      height: 1.25rem;
    }
  `]
})
export class AppConfigListComponent implements OnInit {
  configurations: AppConfiguration[] = [];
  loading = false;
  error: string | null = null;

  constructor(
    private appConfigService: AppConfigService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadConfigurations();
  }

  loadConfigurations(): void {
    this.loading = true;
    this.error = null;
    
    this.appConfigService.getConfigurations().subscribe({
      next: (configs) => {
        this.configurations = configs;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load configurations';
        this.loading = false;
        console.error('Error loading configurations:', err);
      },
    });
  }

  createNew(): void {
    this.router.navigate(['/dashboard/app-config/designer']);
  }

  editConfiguration(id: string): void {
    this.router.navigate(['/dashboard/app-config/designer', id]);
  }

  duplicateConfiguration(config: AppConfiguration): void {
    const newConfig = {
      ...config,
      name: `${config.name} (Copy)`,
      domain: undefined, // Clear domain to avoid conflicts
    };
    delete (newConfig as any).id;
    delete (newConfig as any).createdAt;
    delete (newConfig as any).updatedAt;

    this.appConfigService.createConfiguration(newConfig).subscribe({
      next: () => {
        this.loadConfigurations();
      },
      error: (err) => {
        console.error('Error duplicating configuration:', err);
        alert('Failed to duplicate configuration');
      },
    });
  }

  deleteConfiguration(config: AppConfiguration): void {
    if (confirm(`Are you sure you want to delete "${config.name}"?`)) {
      this.appConfigService.deleteConfiguration(config.id).subscribe({
        next: () => {
          this.loadConfigurations();
        },
        error: (err) => {
          console.error('Error deleting configuration:', err);
          alert('Failed to delete configuration');
        },
      });
    }
  }
}
