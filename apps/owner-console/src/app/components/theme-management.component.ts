import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AppConfiguration,
  AppConfigReleaseRevision,
  ThemeConfig,
} from '@optimistic-tanuki/app-config-models';
import {
  PREDEFINED_PERSONALITIES,
  type Personality,
} from '@optimistic-tanuki/theme-models';
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

      <div class="error" *ngIf="error" aria-live="polite">{{ error }}</div>
      <div class="success" *ngIf="successMessage" aria-live="polite">
        {{ successMessage }}
      </div>

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
        <section class="panel release-panel">
          <div class="panel-heading">
            <div>
              <p class="hero-kicker">Release Management</p>
              <h2>{{ releaseStatusLabel() }}</h2>
              <p>
                Publish theme changes with release notes, open the current
                preview target, and roll back to a prior published revision if
                the experience regresses.
              </p>
            </div>
            <a
              *ngIf="previewUrl() as currentPreviewUrl"
              class="preview-link"
              [href]="currentPreviewUrl"
              target="_blank"
              rel="noreferrer"
            >
              Open preview
            </a>
          </div>

          <div class="field-grid release-fields">
            <label class="wide">
              <span>Release notes</span>
              <textarea
                rows="3"
                [(ngModel)]="releaseNotes"
                placeholder="Summarize what changed in this theme release."
              ></textarea>
            </label>
            <label class="wide">
              <span>Change summary</span>
              <textarea
                rows="3"
                [(ngModel)]="changeSummary"
                placeholder="Capture the visual or personality changes in this revision."
              ></textarea>
            </label>
          </div>

          <div class="actions release-actions">
            <button
              class="btn secondary"
              (click)="saveTheme()"
              [disabled]="saving"
            >
              {{ saving ? 'Saving…' : 'Save draft' }}
            </button>
            <button
              class="btn primary"
              (click)="publishTheme()"
              [disabled]="saving"
            >
              {{ saving ? 'Publishing…' : 'Publish theme' }}
            </button>
          </div>

          <div class="release-history" *ngIf="releaseHistory().length">
            <div class="release-history-header">
              <div>
                <h3>Release history</h3>
                <p>Roll back to a known-good theme revision if needed.</p>
              </div>
            </div>
            <div class="history-list">
              <article
                class="history-item"
                *ngFor="let revision of releaseHistory()"
              >
                <div class="history-copy">
                  <strong>Version {{ revision.version }}</strong>
                  <span>{{ revision.releaseNotes }}</span>
                  <small *ngIf="revision.changeSummary">{{
                    revision.changeSummary
                  }}</small>
                </div>
                <button
                  class="btn secondary"
                  (click)="rollbackTheme(revision.version)"
                  [disabled]="saving"
                >
                  Roll back
                </button>
              </article>
            </div>
          </div>
        </section>

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
              <span>Theme mode</span>
              <select
                [ngModel]="themeDraft.mode"
                (ngModelChange)="updateThemeField('mode', $event)"
              >
                <option *ngFor="let mode of themeModes" [value]="mode">
                  {{ mode === 'light' ? 'Light' : 'Dark' }}
                </option>
              </select>
            </label>
            <label>
              <span>Personality</span>
              <select
                [ngModel]="themeDraft.personalityId"
                (ngModelChange)="updateThemeField('personalityId', $event)"
              >
                <option
                  *ngFor="let personality of personalities"
                  [value]="personality.id"
                >
                  {{ personality.name }}
                </option>
              </select>
            </label>
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
                placeholder="e.g. “IBM Plex Sans”, sans-serif…"
              />
            </label>
            <label class="wide">
              <span>Custom CSS</span>
              <textarea
                rows="8"
                [ngModel]="themeDraft.customCss"
                (ngModelChange)="updateThemeField('customCss', $event)"
                placeholder=".hero { letter-spacing: 0.02em; }…"
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
        background: linear-gradient(
          180deg,
          color-mix(in srgb, var(--surface, #ffffff) 96%, transparent),
          color-mix(
            in srgb,
            var(--surface, #ffffff) 88%,
            var(--primary, #831843) 12%
          )
        );
        color: var(--foreground, #111827);
        padding: 24px;
      }

      .hero-kicker,
      .label,
      .preview-kicker {
        color: var(--primary, #be185d);
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
        background: color-mix(
          in srgb,
          var(--danger, #dc2626) 12%,
          var(--surface, #ffffff)
        );
        color: var(--danger, #b91c1c);
      }

      .success {
        background: color-mix(
          in srgb,
          var(--success, #10b981) 14%,
          var(--surface, #ffffff)
        );
        color: var(--success, #047857);
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
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 94%,
          var(--background, #f8fafc)
        );
        color: var(--foreground, inherit);
      }

      input[type='color'] {
        min-height: 48px;
        padding: 0.35rem;
      }

      textarea {
        resize: vertical;
      }

      input:focus-visible,
      textarea:focus-visible,
      select:focus-visible,
      .btn:focus-visible,
      .preview-btn:focus-visible,
      .preview-link:focus-visible {
        outline: 2px solid transparent;
        border-color: color-mix(
          in srgb,
          var(--primary, #831843) 65%,
          var(--border-color, #d6d6d6)
        );
        box-shadow: 0 0 0 3px
          color-mix(in srgb, var(--primary, #831843) 18%, transparent);
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
        background: var(--primary, #831843);
        border-color: var(--primary, #831843);
        color: var(--on-primary, #fff);
      }

      .btn.secondary,
      .preview-btn.ghost {
        background: transparent;
        color: var(--foreground, inherit);
      }

      .btn:hover,
      .preview-btn:hover,
      .preview-link:hover {
        border-color: color-mix(
          in srgb,
          var(--primary, #831843) 55%,
          var(--border-color, #d6d6d6)
        );
      }

      .preview-panel {
        align-content: start;
      }

      .release-panel {
        grid-column: 1 / -1;
      }

      .release-fields,
      .release-history,
      .history-list {
        display: grid;
        gap: 16px;
      }

      .release-actions {
        margin-top: 0;
      }

      .release-history {
        margin-top: 20px;
      }

      .release-history-header h3 {
        margin-bottom: 4px;
      }

      .history-item {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: center;
        padding: 16px;
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 16px;
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 92%,
          var(--background, #f8fafc)
        );
      }

      .history-copy {
        display: grid;
        gap: 4px;
      }

      .preview-link {
        color: var(--primary, #831843);
        font-weight: 700;
        text-decoration: none;
      }

      .preview-card {
        display: grid;
        gap: 16px;
        border-radius: 20px;
        padding: 24px;
        min-height: 280px;
        box-shadow: var(
          --personality-box-shadow,
          0 18px 40px rgba(15, 23, 42, 0.12)
        );
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
  readonly themeModes: Array<'light' | 'dark'> = ['light', 'dark'];
  readonly personalities: Personality[] = PREDEFINED_PERSONALITIES;

  configurations: AppConfiguration[] = [];
  selectedConfigId = '';
  selectedConfiguration: AppConfiguration | null = null;
  themeDraft: ThemeDraft = this.createDraft();
  error = '';
  successMessage = '';
  saving = false;
  releaseNotes = '';
  changeSummary = '';

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
    this.releaseNotes = this.selectedConfiguration?.release?.releaseNotes ?? '';
    this.changeSummary =
      this.selectedConfiguration?.release?.changeSummary ?? '';
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

  publishTheme(): void {
    if (!this.selectedConfiguration) {
      return;
    }

    if (!this.releaseNotes.trim()) {
      this.error = 'Release notes are required before publishing the theme.';
      return;
    }

    this.saving = true;
    this.error = '';
    this.successMessage = '';

    this.appConfigService
      .publishConfiguration(this.selectedConfiguration.id, {
        releaseNotes: this.releaseNotes.trim(),
        changeSummary: this.changeSummary.trim() || undefined,
      })
      .subscribe({
        next: (publishedConfiguration) => {
          this.saving = false;
          this.successMessage = `Theme published for ${publishedConfiguration.name}.`;
          this.syncSelectedConfiguration(publishedConfiguration);
        },
        error: () => {
          this.saving = false;
          this.error = 'Failed to publish theme settings.';
        },
      });
  }

  rollbackTheme(version: number): void {
    if (!this.selectedConfiguration) {
      return;
    }

    this.saving = true;
    this.error = '';
    this.successMessage = '';

    this.appConfigService
      .rollbackConfiguration(this.selectedConfiguration.id, {
        version,
        releaseNotes: 'Rollback from theme management',
      })
      .subscribe({
        next: (rolledBackConfiguration) => {
          this.saving = false;
          this.successMessage = `Theme rolled back for ${rolledBackConfiguration.name}.`;
          this.syncSelectedConfiguration(rolledBackConfiguration);
        },
        error: () => {
          this.saving = false;
          this.error = 'Failed to rollback theme settings.';
        },
      });
  }

  releaseStatusLabel(): string {
    const status = this.selectedConfiguration?.release?.status;
    if (status === 'published') {
      return 'Published';
    }
    if (status === 'changes-pending') {
      return 'Changes Pending';
    }
    return 'Draft';
  }

  releaseHistory(): AppConfigReleaseRevision[] {
    return [...(this.selectedConfiguration?.release?.history ?? [])].sort(
      (left, right) => right.version - left.version
    );
  }

  previewUrl(): string | null {
    return this.selectedConfiguration?.release?.previewUrl ?? null;
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
      mode: theme?.mode ?? 'light',
      personalityId: theme?.personalityId ?? 'professional',
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
    this.themeService.setTheme(this.themeDraft.mode);
    void this.themeService.setPersonality(this.themeDraft.personalityId);
  }

  private syncSelectedConfiguration(configuration: AppConfiguration): void {
    this.configurations = this.configurations.map((currentConfiguration) =>
      currentConfiguration.id === configuration.id
        ? configuration
        : currentConfiguration
    );
    this.selectedConfiguration = configuration;
    this.themeDraft = this.createDraft(configuration.theme);
    this.releaseNotes = configuration.release?.releaseNotes ?? '';
    this.changeSummary = configuration.release?.changeSummary ?? '';
    this.applyPreviewTheme();
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
