/**
 * Personality Selector Component for CDK Overlay
 * Allows users to choose from predefined design personalities
 */

import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Personality,
  getPersonalityById,
  ThemeService,
} from '@optimistic-tanuki/theme-lib';
import { Subject, takeUntil } from 'rxjs';

interface GroupedPersonality {
  category: string;
  personalities: Personality[];
}

@Component({
  selector: 'lib-personality-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="personality-overlay-container">
      <div class="overlay-header">
        <h2 class="overlay-title">Choose Your Style</h2>
        <button
          class="close-button"
          (click)="onClose.emit()"
          aria-label="Close"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="overlay-content">
        <div class="current-selection" *ngIf="currentPersonality">
          <span class="current-label">Current:</span>
          <span class="current-name">{{ currentPersonality.name }}</span>
        </div>

        <div class="personality-groups">
          <div
            *ngFor="let group of groupedPersonalities"
            class="personality-group"
          >
            <h3 class="group-label">{{ getCategoryLabel(group.category) }}</h3>
            <div class="personality-options">
              <button
                *ngFor="let personality of group.personalities"
                class="personality-option"
                [class.selected]="personality.id === currentPersonality?.id"
                [attr.data-personality]="personality.id"
                (click)="selectPersonality(personality)"
                type="button"
              >
                <div class="option-preview">
                  <div
                    class="preview-swatch"
                    [style.background]="
                      getPreviewColor(personality, 'background')
                    "
                  ></div>
                </div>
                <div class="option-content">
                  <span class="option-name">
                    {{ personality.name }}
                    <span *ngIf="personality.isClassic" class="classic-badge"
                      >Classic</span
                    >
                  </span>
                  <span class="option-description">{{
                    personality.description
                  }}</span>
                  <div class="option-meta">
                    <span class="meta-tag">{{
                      personality.tokens.typography
                    }}</span>
                    <span class="meta-tag">{{
                      personality.tokens.spacingScale
                    }}</span>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="overlay-footer">
        <p class="hint">Click any style to apply it instantly</p>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .personality-overlay-container {
        background: var(--surface, #ffffff);
        border: var(--border-width, 1px) solid var(--primary);
        border-radius: var(--border-radius-lg, 12px);
        box-shadow: var(--shadow-xl, 0 25px 50px -12px rgba(0, 0, 0, 0.25));
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: var(--font-body, system-ui, sans-serif);
      }

      .overlay-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--spacing-md, 16px) var(--spacing-lg, 24px);
        background: var(--primary);
        color: var(--primary-foreground, #ffffff);
        flex-shrink: 0;
      }

      .overlay-title {
        margin: 0;
        font-family: var(--font-heading, system-ui, sans-serif);
        font-size: 1.25rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.02em;
      }

      .close-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        padding: 0;
        background: transparent;
        border: 2px solid var(--primary-foreground, #ffffff);
        color: var(--primary-foreground, #ffffff);
        cursor: pointer;
        border-radius: var(--border-radius-sm, 4px);
        transition: all var(--animation-duration-fast, 100ms)
          var(--animation-easing, ease);

        &:hover {
          background: var(--secondary);
          border-color: var(--secondary);
          color: #000;
          transform: scale(1.1);
        }

        svg {
          width: 20px;
          height: 20px;
        }
      }

      .overlay-content {
        flex: 1;
        overflow-y: auto;
        padding: var(--spacing-md, 16px);
      }

      .current-selection {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs, 8px);
        padding: var(--spacing-sm, 12px) var(--spacing-md, 16px);
        background: var(--background-elevated, #fafafa);
        border-radius: var(--border-radius-md, 8px);
        margin-bottom: var(--spacing-md, 16px);
        font-size: 0.875rem;
      }

      .current-label {
        color: var(--muted, #737373);
        font-weight: 500;
      }

      .current-name {
        color: var(--primary);
        font-weight: 700;
      }

      .personality-groups {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-md, 16px);
      }

      .personality-group {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xs, 8px);
      }

      .group-label {
        margin: 0;
        padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
        font-family: var(--font-mono, monospace);
        font-size: 0.625rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--muted, #737373);
        background: var(--background-elevated, #fafafa);
        border-radius: var(--border-radius-sm, 4px);
      }

      .personality-options {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xs, 8px);
      }

      .personality-option {
        display: flex;
        align-items: flex-start;
        gap: var(--spacing-sm, 12px);
        padding: var(--spacing-sm, 12px);
        background: transparent;
        border: 1px solid var(--border, #e5e7eb);
        border-radius: var(--border-radius-md, 8px);
        cursor: pointer;
        text-align: left;
        transition: all var(--animation-duration-fast, 150ms)
          var(--animation-easing, ease);

        &:hover {
          background: var(--surface, #f9fafb);
          border-color: var(--primary);
          transform: translateX(4px);
        }

        &.selected {
          background: color-mix(in srgb, var(--primary) 10%, var(--background));
          border-color: var(--primary);
          border-width: 2px;

          .option-name {
            color: var(--primary);
          }
        }
      }

      .option-preview {
        flex-shrink: 0;
      }

      .preview-swatch {
        width: 48px;
        height: 48px;
        border-radius: var(--border-radius-md, 8px);
        border: 2px solid var(--border, #e5e7eb);
        box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
      }

      .option-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xs, 4px);
      }

      .option-name {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs, 8px);
        font-family: var(--font-heading, system-ui, sans-serif);
        font-size: 0.9375rem;
        font-weight: 600;
        color: var(--foreground, #171717);
      }

      .classic-badge {
        font-size: 0.625rem;
        padding: 2px 6px;
        background: var(--primary);
        color: var(--primary-foreground, #ffffff);
        border-radius: 9999px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .option-description {
        font-size: 0.75rem;
        color: var(--muted, #737373);
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .option-meta {
        display: flex;
        gap: var(--spacing-xs, 8px);
        margin-top: var(--spacing-xs, 4px);
      }

      .meta-tag {
        font-size: 0.6875rem;
        padding: 2px 6px;
        background: var(--background-elevated, #f3f4f6);
        color: var(--foreground-secondary, #6b7280);
        border-radius: var(--border-radius-sm, 4px);
        text-transform: capitalize;
        font-family: var(--font-mono, monospace);
      }

      .overlay-footer {
        padding: var(--spacing-sm, 12px) var(--spacing-md, 16px);
        border-top: 1px solid var(--border, #e5e7eb);
        background: var(--background-elevated, #fafafa);
        flex-shrink: 0;
      }

      .hint {
        margin: 0;
        font-size: 0.75rem;
        color: var(--muted, #737373);
        text-align: center;
        font-style: italic;
      }

      // Scrollbar styling
      .overlay-content::-webkit-scrollbar {
        width: 8px;
      }

      .overlay-content::-webkit-scrollbar-track {
        background: var(--background-elevated, #f3f4f6);
        border-radius: var(--border-radius-sm, 4px);
      }

      .overlay-content::-webkit-scrollbar-thumb {
        background: var(--border, #d1d5db);
        border-radius: var(--border-radius-sm, 4px);

        &:hover {
          background: var(--muted, #9ca3af);
        }
      }
    `,
  ],
})
export class PersonalitySelectorComponent implements OnInit, OnDestroy {
  @Input() personalities: Personality[] = [];
  @Input() currentPersonality: Personality | null = null;
  @Output() personalitySelected = new EventEmitter<Personality>();
  @Output() onClose = new EventEmitter<void>();

  groupedPersonalities: GroupedPersonality[] = [];
  currentPrimaryColor = '#3f51b5';

  private destroy$ = new Subject<void>();

  constructor(private themeService: ThemeService) {}

  ngOnInit(): void {
    this.groupPersonalities();

    // Subscribe to primary color changes
    this.themeService.generatedTheme$
      .pipe(takeUntil(this.destroy$))
      .subscribe((theme) => {
        if (theme) {
          this.currentPrimaryColor = theme.config.primaryColor;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Generate preview color for personality based on current primary color
   */
  getPreviewColor(
    personality: Personality,
    type: 'background' | 'foreground'
  ): string {
    const hue = this.extractHueFromHex(this.currentPrimaryColor);
    const config = personality.colorGeneration;

    if (type === 'background') {
      const hsl = {
        h: hue,
        s: config.neutralSaturation,
        l: config.backgroundLuminosity,
      };
      return this.hslToHex(hsl);
    } else {
      const bgLuminosity = config.backgroundLuminosity;
      const fgLuminosity = Math.max(
        0,
        bgLuminosity - config.foregroundContrast
      );
      const hsl = {
        h: hue,
        s: config.neutralSaturation,
        l: fgLuminosity,
      };
      return this.hslToHex(hsl);
    }
  }

  private extractHueFromHex(hex: string): number {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return 0;

    const r = parseInt(result[1], 16) / 255;
    const g = parseInt(result[2], 16) / 255;
    const b = parseInt(result[3], 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;

    if (max !== min) {
      const d = max - min;
      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return h * 360;
  }

  private hslToHex({ h, s, l }: { h: number; s: number; l: number }): string {
    const hDecimal = h / 360;
    const sDecimal = s / 100;
    const lDecimal = l / 100;

    let r: number, g: number, b: number;

    if (sDecimal === 0) {
      r = g = b = lDecimal;
    } else {
      const hue2rgb = (p: number, q: number, t: number): number => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q =
        lDecimal < 0.5
          ? lDecimal * (1 + sDecimal)
          : lDecimal + sDecimal - lDecimal * sDecimal;
      const p = 2 * lDecimal - q;
      r = hue2rgb(p, q, hDecimal + 1 / 3);
      g = hue2rgb(p, q, hDecimal);
      b = hue2rgb(p, q, hDecimal - 1 / 3);
    }

    const toHex = (x: number): string => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  private groupPersonalities(): void {
    const groups: Record<string, Personality[]> = {};

    for (const personality of this.personalities) {
      if (!groups[personality.category]) {
        groups[personality.category] = [];
      }
      groups[personality.category].push(personality);
    }

    this.groupedPersonalities = Object.entries(groups).map(
      ([category, personalities]) => ({
        category,
        personalities,
      })
    );
  }

  selectPersonality(personality: Personality): void {
    this.personalitySelected.emit(personality);
  }

  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      professional: 'Professional',
      creative: 'Creative',
      casual: 'Casual',
      technical: 'Technical',
    };
    return labels[category] || category;
  }
}
