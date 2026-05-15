import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AppConfiguration,
  ThemeConfig,
} from '@optimistic-tanuki/app-config-models';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { AppConfigService } from '../services/app-config.service';

type ThemeDraft = Required<ThemeConfig>;

@Component({
  selector: 'app-theme-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="theme-page">
      <header class="hero">
        <p class="hero-kicker">Experience</p>
        <h1>Theme Management</h1>
        <p>
          Persist theme settings for platform-controlled applications through
          the existing app configuration service.
        </p>
      </header>

      <div class="error" *ngIf="error">{{ error }}</div>
      <div class="success" *ngIf="successMessage">{{ successMessage }}</div>

      <section class="panel" *ngIf="configurations.length; else emptyState">
        <div class="panel-heading">
          <div>
            <h2>Configuration target</h2>
            <p>Select which application theme payload to edit.</p>
          </div>
          <select
            [ngModel]="selectedConfigId"
            (ngModelChange)="selectConfiguration($event)"
          >
            <option
              *ngFor="let configuration of configurations"
              [value]="configuration.id"
            >
              {{ configuration.name }}
              {{ configuration.domain ? '· ' + configuration.domain : '' }}
            </option>
          </select>
        </div>

        <div class="config-meta" *ngIf="selectedConfiguration">
          <div>
            <span class="label">Configuration</span>
            <strong>{{ selectedConfiguration.name }}</strong>
          </div>
          <div>
            <span class="label">Domain</span>
            <strong>{{ selectedConfiguration.domain || 'Unassigned' }}</strong>
          </div>
          <div>
            <span class="label">Status</span>
            <strong>{{
              selectedConfiguration.active ? 'Active' : 'Inactive'
            }}</strong>
          </div>
        </div>
      </section>

      <section class="editor-grid" *ngIf="selectedConfiguration">
        <section class="panel">
          <div class="panel-heading">
            <div>
              <h2>Persisted theme fields</h2>
              <p>
                Update the stored theme payload that downstream apps can load at
                runtime.
              </p>
            </div>
          </div>

          <div class="field-grid">
            <label>
              <span>Primary color</span>
              <input
                type="color"
                [ngModel]="themeDraft.primaryColor"
                (ngModelChange)="updateThemeField('primaryColor', $event)"
              />
            </label>
            <label>
              <span>Secondary color</span>
              <input
                type="color"
                [ngModel]="themeDraft.secondaryColor"
                (ngModelChange)="updateThemeField('secondaryColor', $event)"
              />
            </label>
            <label>
              <span>Background color</span>
              <input
                type="color"
                [ngModel]="themeDraft.backgroundColor"
                (ngModelChange)="updateThemeField('backgroundColor', $event)"
              />
            </label>
            <label>
              <span>Text color</span>
              <input
                type="color"
                [ngModel]="themeDraft.textColor"
                (ngModelChange)="updateThemeField('textColor', $event)"
              />
            </label>
            <label class="wide">
              <span>Font family</span>
              <input
                type="text"
                [ngModel]="themeDraft.fontFamily"
                (ngModelChange)="updateThemeField('fontFamily', $event)"
                placeholder="e.g. 'IBM Plex Sans', sans-serif"
              />
            </label>
            <label class="wide">
              <span>Custom CSS</span>
              <textarea
                rows="8"
                [ngModel]="themeDraft.customCss"
                (ngModelChange)="updateThemeField('customCss', $event)"
                placeholder=".hero { letter-spacing: 0.02em; }"
              ></textarea>
            </label>
          </div>

          <div class="actions">
            <button
              class="btn secondary"
              (click)="resetDraft()"
              [disabled]="saving"
            >
              Reset
            </button>
            <button
              class="btn primary"
              (click)="saveTheme()"
              [disabled]="saving"
            >
              {{ saving ? 'Saving…' : 'Save theme' }}
            </button>
          </div>
        </section>

        <section class="panel preview-panel">
          <div class="panel-heading">
            <div>
              <h2>Live preview</h2>
              <p>
                Preview the persisted palette before saving it back to the app
                configuration record.
              </p>
            </div>
          </div>

          <article class="preview-card" [ngStyle]="previewStyle">
            <p class="preview-kicker">Preview</p>
            <h3>{{ selectedConfiguration.name }}</h3>
            <p>
              This card reflects the current draft values for colors, type, and
              optional CSS.
            </p>
            <div class="preview-actions">
              <button class="preview-btn">Primary action</button>
              <button class="preview-btn ghost">Secondary action</button>
            </div>
          </article>
        </section>
      </section>

      <ng-template #emptyState>
        <section class="panel">
          <h2>No app configurations found</h2>
          <p>
            Create an application configuration first, then return here to
            persist its theme settings.
          </p>
        </section>
      </ng-template>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 24px;
      }

      .theme-page {
        display: grid;
        gap: 24px;
      }

      .hero,
      .panel {
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 24px;
        background: radial-gradient(
            circle at top left,
            rgba(244, 114, 182, 0.1),
            transparent 30%
          ),
          linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.97),
            rgba(249, 244, 247, 0.94)
          );
        padding: 24px;
      }

      .hero-kicker,
      .label,
      .preview-kicker {
        color: #be185d;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .error,
      .success {
        padding: 12px 16px;
        border-radius: 12px;
      }

      .error {
        background: rgba(220, 38, 38, 0.08);
        color: #b91c1c;
      }

      .success {
        background: rgba(16, 185, 129, 0.12);
        color: #047857;
      }

      .panel-heading {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: start;
        margin-bottom: 18px;
      }

      .config-meta,
      .editor-grid,
      .field-grid,
      .preview-actions {
        display: grid;
      }

      .config-meta {
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
      }

      .editor-grid {
        grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.9fr);
        gap: 24px;
      }

      .field-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }

      label {
        display: grid;
        gap: 8px;
        font-weight: 600;
      }

      label span {
        font-size: 0.92rem;
      }

      .wide {
        grid-column: 1 / -1;
      }

      input,
      textarea,
      select,
      .btn,
      .preview-btn {
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 10px;
        padding: 0.7rem 0.9rem;
        background: rgba(255, 255, 255, 0.96);
        color: inherit;
      }

      input[type='color'] {
        min-height: 48px;
        padding: 0.35rem;
      }

      textarea {
        resize: vertical;
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 20px;
      }

      .btn,
      .preview-btn {
        cursor: pointer;
        font-weight: 600;
      }

      .btn.primary,
      .preview-btn {
        background: #831843;
        border-color: #831843;
        color: #fff;
      }

      .btn.secondary,
      .preview-btn.ghost {
        background: transparent;
        color: inherit;
      }

      .preview-panel {
        align-content: start;
      }

      .preview-card {
        display: grid;
        gap: 16px;
        border-radius: 20px;
        padding: 24px;
        min-height: 280px;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
      }

      .preview-actions {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      @media (max-width: 900px) {
        .editor-grid,
        .field-grid {
          grid-template-columns: 1fr;
        }

        .panel-heading {
          flex-direction: column;
        }
      }
    `,
  ],
})
export class ThemeManagementComponent implements OnInit {
  private readonly appConfigService = inject(AppConfigService);
  private readonly themeService = inject(ThemeService);

  configurations: AppConfiguration[] = [];
  selectedConfigId = '';
  selectedConfiguration: AppConfiguration | null = null;
  themeDraft: ThemeDraft = this.createDraft();
  error = '';
  successMessage = '';
  saving = false;

  ngOnInit(): void {
    this.loadConfigurations();
  }

  get previewStyle(): Record<string, string> {
    return {
      background: this.themeDraft.backgroundColor,
      color: this.themeDraft.textColor,
      fontFamily: this.themeDraft.fontFamily,
      border: `1px solid ${this.themeDraft.secondaryColor}`,
      boxShadow: `0 18px 40px ${this.withAlpha(
        this.themeDraft.primaryColor,
        0.22
      )}`,
    };
  }

  selectConfiguration(id: string): void {
    this.successMessage = '';
    this.selectedConfigId = id;
    this.selectedConfiguration =
      this.configurations.find((configuration) => configuration.id === id) ??
      null;
    this.themeDraft = this.createDraft(this.selectedConfiguration?.theme);
    this.applyPreviewTheme();
  }

  updateThemeField<K extends keyof ThemeDraft>(
    field: K,
    value: ThemeDraft[K]
  ): void {
    this.themeDraft = { ...this.themeDraft, [field]: value };
    this.applyPreviewTheme();
  }

  resetDraft(): void {
    this.successMessage = '';
    this.themeDraft = this.createDraft(this.selectedConfiguration?.theme);
    this.applyPreviewTheme();
  }

  saveTheme(): void {
    if (!this.selectedConfiguration) {
      return;
    }

    this.saving = true;
    this.error = '';
    this.successMessage = '';

    this.appConfigService
      .updateConfiguration(this.selectedConfiguration.id, {
        theme: { ...this.themeDraft },
      })
      .subscribe({
        next: (updatedConfiguration) => {
          this.saving = false;
          this.successMessage = `Saved theme for ${updatedConfiguration.name}.`;
          this.configurations = this.configurations.map((configuration) =>
            configuration.id === updatedConfiguration.id
              ? updatedConfiguration
              : configuration
          );
          this.selectedConfiguration = updatedConfiguration;
          this.themeDraft = this.createDraft(updatedConfiguration.theme);
          this.applyPreviewTheme();
        },
        error: () => {
          this.saving = false;
          this.error = 'Failed to save theme settings.';
        },
      });
  }

  private loadConfigurations(): void {
    this.error = '';

    this.appConfigService.getConfigurations().subscribe({
      next: (configurations) => {
        this.configurations = configurations;
        const defaultConfiguration =
          this.pickDefaultConfiguration(configurations);
        if (defaultConfiguration) {
          this.selectConfiguration(defaultConfiguration.id);
        }
      },
      error: () => {
        this.error = 'Failed to load application configurations.';
      },
    });
  }

  private pickDefaultConfiguration(
    configurations: AppConfiguration[]
  ): AppConfiguration | null {
    if (!configurations.length) {
      return null;
    }

    return (
      configurations.find((configuration) =>
        `${configuration.name} ${configuration.domain ?? ''}`
          .toLowerCase()
          .includes('christopherrutherford-net')
      ) ?? configurations[0]
    );
  }

  private createDraft(theme?: ThemeConfig): ThemeDraft {
    return {
      primaryColor: theme?.primaryColor ?? '#831843',
      secondaryColor: theme?.secondaryColor ?? '#f472b6',
      backgroundColor: theme?.backgroundColor ?? '#fff7fb',
      textColor: theme?.textColor ?? '#1f1721',
      fontFamily: theme?.fontFamily ?? '"IBM Plex Sans", sans-serif',
      customCss: theme?.customCss ?? '',
    };
  }

  private applyPreviewTheme(): void {
    this.themeService.setPrimaryColor(this.themeDraft.primaryColor);
  }

  private withAlpha(hexColor: string, alpha: number): string {
    const normalized = hexColor.replace('#', '');
    if (normalized.length !== 6) {
      return `rgba(131, 24, 67, ${alpha})`;
    }

    const red = parseInt(normalized.slice(0, 2), 16);
    const green = parseInt(normalized.slice(2, 4), 16);
    const blue = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }
}
