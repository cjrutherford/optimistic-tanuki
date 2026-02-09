/**
 * Personality Preview Component
 * Shows a live preview of how components look with the selected personality
 */

import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ThemeService,
  Personality,
  GeneratedTheme,
} from '@optimistic-tanuki/theme-lib';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'lib-personality-preview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="personality-preview">
      <div class="preview-header">
        <h4>Live Preview</h4>
        <p class="subtitle">See how your UI looks with this personality</p>
      </div>

      <div
        class="preview-container"
        [attr.data-personality]="currentPersonality?.id"
      >
        <!-- Typography Preview -->
        <section class="preview-section">
          <h5 class="section-title">Typography</h5>
          <div class="typography-demo">
            <h1>Heading 1</h1>
            <h2>Heading 2</h2>
            <h3>Heading 3</h3>
            <p class="body-text">
              This is body text. It demonstrates the personality's font family,
              line height, and letter spacing. The quick brown fox jumps over
              the lazy dog.
            </p>
            <p class="muted-text">
              This is muted text, often used for secondary information.
            </p>
            <code class="code-text">const example = "monospace font";</code>
          </div>
        </section>

        <!-- Color Preview -->
        <section class="preview-section">
          <h5 class="section-title">Colors</h5>
          <div class="color-palette" *ngIf="currentTheme">
            <div class="color-group">
              <span class="color-label">Primary</span>
              <div class="color-swatches">
                <div
                  *ngFor="
                    let shade of currentTheme.colors.primaryShades.slice(0, 5);
                    let i = index
                  "
                  class="color-swatch"
                  [style.background]="shade"
                  [attr.data-shade]="i"
                ></div>
              </div>
            </div>

            <div class="color-group">
              <span class="color-label">Secondary</span>
              <div class="color-swatches">
                <div
                  *ngFor="
                    let shade of currentTheme.colors.secondaryShades.slice(
                      0,
                      5
                    );
                    let i = index
                  "
                  class="color-swatch"
                  [style.background]="shade"
                  [attr.data-shade]="i"
                ></div>
              </div>
            </div>

            <div class="color-group">
              <span class="color-label">Tertiary</span>
              <div class="color-swatches">
                <div
                  *ngFor="
                    let shade of currentTheme.colors.tertiaryShades.slice(0, 5);
                    let i = index
                  "
                  class="color-swatch"
                  [style.background]="shade"
                  [attr.data-shade]="i"
                ></div>
              </div>
            </div>

            <div class="color-group semantic">
              <span class="color-label">Semantic</span>
              <div class="semantic-colors">
                <div
                  class="semantic-swatch success"
                  [style.background]="currentTheme.colors.success"
                >
                  <span>Success</span>
                </div>
                <div
                  class="semantic-swatch warning"
                  [style.background]="currentTheme.colors.warning"
                >
                  <span>Warning</span>
                </div>
                <div
                  class="semantic-swatch danger"
                  [style.background]="currentTheme.colors.danger"
                >
                  <span>Danger</span>
                </div>
                <div
                  class="semantic-swatch info"
                  [style.background]="currentTheme.colors.info"
                >
                  <span>Info</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Components Preview -->
        <section class="preview-section">
          <h5 class="section-title">Components</h5>
          <div class="components-demo">
            <!-- Buttons -->
            <div class="demo-row">
              <span class="demo-label">Buttons</span>
              <div class="demo-buttons">
                <button class="btn btn-primary">Primary</button>
                <button class="btn btn-secondary">Secondary</button>
                <button class="btn btn-tertiary">Tertiary</button>
                <button class="btn btn-outline">Outline</button>
              </div>
            </div>

            <!-- Cards -->
            <div class="demo-row">
              <span class="demo-label">Card</span>
              <div class="demo-card">
                <h6>Card Title</h6>
                <p>
                  This card uses the personality's border radius, shadow, and
                  spacing.
                </p>
                <button class="btn btn-primary btn-sm">Action</button>
              </div>
            </div>

            <!-- Inputs -->
            <div class="demo-row">
              <span class="demo-label">Input</span>
              <div class="demo-input-group">
                <input
                  type="text"
                  class="demo-input"
                  placeholder="Enter text..."
                />
                <select class="demo-select">
                  <option>Select option</option>
                </select>
              </div>
            </div>

            <!-- Alerts -->
            <div class="demo-row">
              <span class="demo-label">Alerts</span>
              <div class="demo-alerts">
                <div class="alert alert-success">
                  <span class="alert-icon">✓</span>
                  Success message
                </div>
                <div class="alert alert-warning">
                  <span class="alert-icon">!</span>
                  Warning message
                </div>
                <div class="alert alert-danger">
                  <span class="alert-icon">✕</span>
                  Error message
                </div>
              </div>
            </div>

            <!-- Badges -->
            <div class="demo-row">
              <span class="demo-label">Badges</span>
              <div class="demo-badges">
                <span class="badge badge-primary">Primary</span>
                <span class="badge badge-secondary">Secondary</span>
                <span class="badge badge-tertiary">Tertiary</span>
                <span class="badge badge-outline">Outline</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Spacing Preview -->
        <section class="preview-section" *ngIf="currentPersonality">
          <h5 class="section-title">Spacing</h5>
          <div class="spacing-demo">
            <div class="spacing-box" [style.padding]="getSpacing('xs')">
              <span class="spacing-label">XS</span>
            </div>
            <div class="spacing-box" [style.padding]="getSpacing('sm')">
              <span class="spacing-label">SM</span>
            </div>
            <div class="spacing-box" [style.padding]="getSpacing('md')">
              <span class="spacing-label">MD</span>
            </div>
            <div class="spacing-box" [style.padding]="getSpacing('lg')">
              <span class="spacing-label">LG</span>
            </div>
            <div class="spacing-box" [style.padding]="getSpacing('xl')">
              <span class="spacing-label">XL</span>
            </div>
          </div>
        </section>

        <!-- Shadow Preview -->
        <section class="preview-section" *ngIf="currentPersonality">
          <h5 class="section-title">Shadows</h5>
          <div class="shadow-demo">
            <div class="shadow-box shadow-sm">Small</div>
            <div class="shadow-box shadow-md">Medium</div>
            <div class="shadow-box shadow-lg">Large</div>
            <div class="shadow-box shadow-xl">Extra Large</div>
          </div>
        </section>

        <!-- Border Radius Preview -->
        <section class="preview-section" *ngIf="currentPersonality">
          <h5 class="section-title">Border Radius</h5>
          <div class="radius-demo">
            <div class="radius-box radius-none">None</div>
            <div class="radius-box radius-sm">Small</div>
            <div class="radius-box radius-md">Medium</div>
            <div class="radius-box radius-lg">Large</div>
            <div class="radius-box radius-full">Full</div>
          </div>
        </section>

        <!-- Animation Preview -->
        <section class="preview-section" *ngIf="currentPersonality">
          <h5 class="section-title">Animation</h5>
          <div class="animation-demo">
            <div class="animation-info">
              <span class="anim-label">Speed:</span>
              <span class="anim-value">{{
                currentPersonality.animations.speed
              }}</span>
            </div>
            <div class="animation-info">
              <span class="anim-label">Easing:</span>
              <span class="anim-value">{{
                currentPersonality.animations.easing
              }}</span>
            </div>
            <div class="animation-examples">
              <button
                class="btn btn-primary anim-btn"
                (click)="triggerAnimation($event)"
              >
                Click to Animate
              </button>
              <div class="anim-box" #animBox></div>
            </div>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [
    `
      .personality-preview {
        padding: 1.5rem;
        max-width: 1200px;
        margin: 0 auto;
      }

      .preview-header {
        text-align: center;
        margin-bottom: 2rem;

        h4 {
          margin: 0 0 0.5rem;
          font-size: 1.5rem;
          color: var(--foreground);
        }

        .subtitle {
          margin: 0;
          color: var(--muted);
          font-size: 0.9rem;
        }
      }

      .preview-container {
        display: flex;
        flex-direction: column;
        gap: 2rem;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--border-radius-lg, 8px);
        padding: 1.5rem;
      }

      .preview-section {
        .section-title {
          font-size: 0.875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--muted);
          margin: 0 0 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--border);
        }
      }

      // Typography
      .typography-demo {
        h1,
        h2,
        h3 {
          margin: 0 0 0.5rem;
          color: var(--foreground);
          font-family: var(--font-heading, var(--font-body));
        }

        h1 {
          font-size: 2rem;
        }
        h2 {
          font-size: 1.5rem;
        }
        h3 {
          font-size: 1.25rem;
        }

        .body-text {
          margin: 0 0 0.5rem;
          color: var(--foreground);
          line-height: var(--line-height, 1.5);
        }

        .muted-text {
          margin: 0 0 0.5rem;
          color: var(--muted);
        }

        .code-text {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          background: var(--background);
          border-radius: var(--border-radius-sm, 2px);
          font-family: var(--font-mono, monospace);
          font-size: 0.85em;
          color: var(--foreground);
        }
      }

      // Colors
      .color-palette {
        display: flex;
        flex-direction: column;
        gap: 1rem;

        .color-group {
          display: flex;
          align-items: center;
          gap: 1rem;

          &.semantic {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        .color-label {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--muted);
          min-width: 80px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .color-swatches {
          display: flex;
          gap: 0.25rem;
        }

        .color-swatch {
          width: 40px;
          height: 40px;
          border-radius: var(--border-radius-sm, 2px);
          border: 1px solid var(--border);
        }

        .semantic-colors {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .semantic-swatch {
          padding: 0.5rem 1rem;
          border-radius: var(--border-radius-md, 4px);
          font-size: 0.875rem;
          font-weight: 500;
          color: white;
        }
      }

      // Components
      .components-demo {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .demo-row {
        display: flex;
        align-items: flex-start;
        gap: 1rem;

        .demo-label {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--muted);
          min-width: 80px;
          text-transform: uppercase;
          padding-top: 0.5rem;
        }
      }

      .demo-buttons {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .btn {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: var(--border-radius-md, 4px);
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;

        &.btn-sm {
          padding: 0.25rem 0.75rem;
          font-size: 0.75rem;
        }

        &.btn-primary {
          background: var(--primary);
          color: var(--primary-foreground);
        }

        &.btn-secondary {
          background: var(--secondary);
          color: var(--secondary-foreground);
        }

        &.btn-tertiary {
          background: var(--tertiary);
          color: var(--tertiary-foreground);
        }

        &.btn-outline {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--foreground);
        }

        &:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }
      }

      .demo-card {
        background: var(--background);
        border: 1px solid var(--border);
        border-radius: var(--border-radius-lg, 8px);
        padding: 1rem;
        box-shadow: var(--shadow-sm);
        max-width: 300px;

        h6 {
          margin: 0 0 0.5rem;
          font-size: 1rem;
          color: var(--foreground);
        }

        p {
          margin: 0 0 1rem;
          font-size: 0.875rem;
          color: var(--muted);
        }
      }

      .demo-input-group {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .demo-input,
      .demo-select {
        padding: 0.5rem;
        border: 1px solid var(--border);
        border-radius: var(--border-radius-md, 4px);
        background: var(--background);
        color: var(--foreground);
        font-size: 0.875rem;

        &:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.1);
        }
      }

      .demo-alerts {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .alert {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        border-radius: var(--border-radius-md, 4px);
        font-size: 0.875rem;

        .alert-icon {
          font-weight: 700;
        }

        &.alert-success {
          background: rgba(var(--success-rgb), 0.1);
          color: var(--success);
          border: 1px solid var(--success);
        }

        &.alert-warning {
          background: rgba(var(--warning-rgb), 0.1);
          color: var(--warning);
          border: 1px solid var(--warning);
        }

        &.alert-danger {
          background: rgba(var(--danger-rgb), 0.1);
          color: var(--danger);
          border: 1px solid var(--danger);
        }
      }

      .demo-badges {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .badge {
        padding: 0.25rem 0.5rem;
        border-radius: var(--border-radius-sm, 2px);
        font-size: 0.75rem;
        font-weight: 500;

        &.badge-primary {
          background: var(--primary);
          color: var(--primary-foreground);
        }

        &.badge-secondary {
          background: var(--secondary);
          color: var(--secondary-foreground);
        }

        &.badge-tertiary {
          background: var(--tertiary);
          color: var(--tertiary-foreground);
        }

        &.badge-outline {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--foreground);
        }
      }

      // Spacing
      .spacing-demo {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .spacing-box {
        background: var(--primary);
        color: var(--primary-foreground);
        border-radius: var(--border-radius-sm, 2px);

        .spacing-label {
          display: block;
          background: var(--surface);
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
          font-weight: 500;
          border-radius: var(--border-radius-sm, 2px);
        }
      }

      // Shadows
      .shadow-demo {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .shadow-box {
        width: 100px;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--border-radius-md, 4px);
        font-size: 0.75rem;
        color: var(--foreground);

        &.shadow-sm {
          box-shadow: var(--shadow-sm);
        }
        &.shadow-md {
          box-shadow: var(--shadow-md);
        }
        &.shadow-lg {
          box-shadow: var(--shadow-lg);
        }
        &.shadow-xl {
          box-shadow: var(--shadow-xl);
        }
      }

      // Border Radius
      .radius-demo {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .radius-box {
        width: 80px;
        height: 80px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--primary);
        color: var(--primary-foreground);
        font-size: 0.75rem;
        font-weight: 500;

        &.radius-none {
          border-radius: 0;
        }
        &.radius-sm {
          border-radius: var(--border-radius-sm);
        }
        &.radius-md {
          border-radius: var(--border-radius-md);
        }
        &.radius-lg {
          border-radius: var(--border-radius-lg);
        }
        &.radius-full {
          border-radius: 50%;
        }
      }

      // Animation
      .animation-demo {
        .animation-info {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;

          .anim-label {
            color: var(--muted);
          }

          .anim-value {
            color: var(--foreground);
            font-weight: 500;
          }
        }

        .animation-examples {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-top: 1rem;
        }

        .anim-box {
          width: 50px;
          height: 50px;
          background: var(--tertiary);
          border-radius: var(--border-radius-md, 4px);
          transition: all var(--animation-duration-normal, 300ms)
            var(--animation-easing, ease);

          &.animate {
            transform: translateX(100px) rotate(360deg);
            background: var(--secondary);
          }
        }
      }

      @media (max-width: 640px) {
        .demo-row {
          flex-direction: column;

          .demo-label {
            min-width: auto;
          }
        }

        .color-group {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `,
  ],
})
export class PersonalityPreviewComponent implements OnInit, OnDestroy {
  @Input() showAllSections = true;

  currentPersonality: Personality | null = null;
  currentTheme: GeneratedTheme | null = null;

  private destroy$ = new Subject<void>();

  constructor(private themeService: ThemeService) {}

  ngOnInit(): void {
    this.themeService.personality$
      .pipe(takeUntil(this.destroy$))
      .subscribe((personality) => {
        this.currentPersonality = personality || null;
      });

    this.themeService.generatedTheme$
      .pipe(takeUntil(this.destroy$))
      .subscribe((theme) => {
        this.currentTheme = theme || null;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getSpacing(size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'): string {
    const spacings: Record<string, string> = {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
    };

    if (this.currentPersonality) {
      const multiplier = this.currentPersonality.tokens.spacingMultiplier;
      const base = parseInt(spacings[size]);
      return `${base * multiplier}px`;
    }

    return spacings[size];
  }

  triggerAnimation(event: MouseEvent): void {
    const btn = event.target as HTMLElement;
    const animBox = btn.parentElement?.querySelector(
      '.anim-box'
    ) as HTMLElement;
    if (animBox) {
      animBox.classList.add('animate');
      setTimeout(() => {
        animBox.classList.remove('animate');
      }, 500);
    }
  }
}
