import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import {
  PREDEFINED_PERSONALITIES,
  ThemeService,
  ThemeValidationHarnessComponent,
} from '@optimistic-tanuki/theme-lib';
import { NavSidebarComponent } from './shared';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    NavSidebarComponent,
    ThemeValidationHarnessComponent,
  ],
  template: `
    <otui-theme-validation-harness
      [personalityId]="activePersonalityId"
      [mode]="activeMode"
      [primaryColor]="primaryColor"
    >
      <div class="app-shell">
        <pg-nav-sidebar />
        <main class="main-content">
          <header class="theme-toolbar" aria-label="Global theme controls">
            <div class="toolbar-copy">
              <span class="toolbar-label">Validation Sweep</span>
              <strong>{{ activePersonalityName }}</strong>
              <p>Switch personalities and mode globally before reviewing any library page.</p>
            </div>

            <label class="personality-picker">
              <span>Personality</span>
              <select
                aria-label="Active personality"
                [value]="activePersonalityId"
                (change)="onPersonalityChange(($any($event.target)).value)"
              >
                @for (personality of personalities; track personality.id) {
                <option [value]="personality.id">{{ personality.name }}</option>
                }
              </select>
            </label>

            <div class="mode-toggle" role="group" aria-label="Color mode">
              <button
                type="button"
                [class.active]="activeMode === 'light'"
                (click)="setMode('light')"
              >
                Light
              </button>
              <button
                type="button"
                [class.active]="activeMode === 'dark'"
                (click)="setMode('dark')"
              >
                Dark
              </button>
            </div>

            <a class="validation-link" routerLink="/validation">Open Validation Board</a>
          </header>

          <router-outlet />
        </main>
      </div>
    </otui-theme-validation-harness>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
      }

      .app-shell {
        min-height: 100vh;
      }

      .main-content {
        margin-left: 280px;
        min-height: 100vh;
        padding: 0 1rem 2rem;
      }

      .theme-toolbar {
        position: sticky;
        top: 0;
        z-index: 120;
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(220px, 0.9fr) auto auto;
        align-items: center;
        gap: 1rem;
        margin: 0 auto 0.75rem;
        padding: 0.95rem 1rem;
        border: 1px solid color-mix(in srgb, var(--border) 92%, transparent);
        border-radius: var(--personality-card-radius, 1.25rem);
        background:
          linear-gradient(
            180deg,
            color-mix(in srgb, var(--surface) 94%, transparent),
            color-mix(in srgb, var(--background) 96%, transparent)
          ),
          var(--page-background-pattern, none);
        backdrop-filter: blur(16px);
        box-shadow: var(--personality-card-shadow, var(--shadow-lg));
      }

      .toolbar-copy {
        min-width: 0;
      }

      .toolbar-label {
        display: block;
        margin-bottom: 0.3rem;
        color: color-mix(in srgb, var(--primary) 76%, var(--foreground));
        font: 600 0.72rem/1 var(--font-mono);
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .toolbar-copy strong {
        display: block;
        font-family: var(--font-heading);
        font-size: 1.1rem;
        letter-spacing: -0.03em;
      }

      .toolbar-copy p {
        margin: 0.22rem 0 0;
        color: color-mix(in srgb, var(--foreground) 70%, var(--background));
        font-size: 0.85rem;
        line-height: 1.45;
      }

      .personality-picker {
        display: grid;
        gap: 0.4rem;
      }

      .personality-picker span {
        color: color-mix(in srgb, var(--foreground) 68%, var(--background));
        font: 600 0.72rem/1 var(--font-mono);
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .personality-picker select,
      .mode-toggle button,
      .validation-link {
        min-height: 2.7rem;
        border: var(--personality-border-width, 1px)
          var(--personality-border-style, solid) var(--border);
        border-radius: var(--personality-button-radius, 0.9rem);
        font: inherit;
      }

      .personality-picker select {
        padding: 0 0.85rem;
        background: color-mix(in srgb, var(--surface) 92%, transparent);
        color: var(--foreground);
      }

      .mode-toggle {
        display: inline-grid;
        grid-auto-flow: column;
        gap: 0.45rem;
      }

      .mode-toggle button {
        padding: 0 0.9rem;
        background: color-mix(in srgb, var(--surface) 92%, transparent);
        color: var(--foreground);
        cursor: pointer;
        transition: var(--personality-transition, 160ms ease);
      }

      .mode-toggle button.active {
        background: var(--primary);
        color: var(--background);
        border-color: var(--primary);
      }

      .validation-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 1rem;
        background: color-mix(in srgb, var(--secondary) 20%, var(--surface));
        color: var(--foreground);
        text-decoration: none;
        font-weight: 600;
      }

      @media (max-width: 960px) {
        .main-content {
          margin-left: 0;
          padding: 0 0.65rem 2rem;
        }

        .theme-toolbar {
          top: 4.5rem;
          grid-template-columns: 1fr;
          align-items: stretch;
        }

        .mode-toggle {
          grid-auto-flow: column;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `,
  ],
})
export class AppComponent {
  readonly personalities = PREDEFINED_PERSONALITIES;
  readonly primaryColor: string;
  activePersonalityId: string;
  activeMode: 'light' | 'dark';

  constructor(private readonly themeService: ThemeService) {
    const config = this.themeService.getPersonalityConfig();
    this.activePersonalityId = config.personalityId;
    this.activeMode = this.themeService.getTheme();
    this.primaryColor = this.themeService.getAccentColor();
  }

  get activePersonalityName(): string {
    return (
      this.personalities.find(
        (personality) => personality.id === this.activePersonalityId
      )?.name ?? 'Classic'
    );
  }

  onPersonalityChange(personalityId: string): void {
    this.activePersonalityId = personalityId;
  }

  setMode(mode: 'light' | 'dark'): void {
    this.activeMode = mode;
  }
}
