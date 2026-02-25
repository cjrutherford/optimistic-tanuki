/**
 * Personality Selector Component
 * Allows users to choose from predefined design personalities
 */

import {
  Component,
  OnInit,
  OnDestroy,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ThemeService,
  Personality,
  PREDEFINED_PERSONALITIES,
  getPersonalityById,
} from '@optimistic-tanuki/theme-lib';
import { Subject, takeUntil } from 'rxjs';

interface PersonalityCard {
  personality: Personality;
  isSelected: boolean;
  previewColors: {
    light: string[];
    dark: string[];
  };
}

@Component({
  selector: 'lib-personality-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="personality-selector">
      <div class="selector-header">
        <h3>Choose Your Design Style</h3>
        <p class="subtitle">
          Select a personality that matches your application's aesthetic
        </p>
      </div>

      <div class="personalities-grid">
        <div
          *ngFor="let card of personalityCards"
          class="personality-card"
          [class.selected]="card.isSelected"
          [attr.data-personality]="card.personality.id"
          (click)="selectPersonality(card.personality.id)"
          (keydown.enter)="selectPersonality(card.personality.id)"
          tabindex="0"
          role="button"
          [attr.aria-pressed]="card.isSelected"
          [attr.aria-label]="'Select ' + card.personality.name + ' personality'"
        >
          <!-- Preview Area -->
          <div class="card-preview">
            <div
              class="preview-background"
              [style.background]="card.previewColors.light[0]"
            >
              <div class="preview-elements">
                <div
                  class="preview-accent"
                  [style.background]="getPrimaryColor()"
                ></div>
                <div
                  class="preview-text"
                  [style.color]="card.previewColors.light[1]"
                >
                  Aa
                </div>
              </div>
            </div>
          </div>

          <!-- Card Content -->
          <div class="card-content">
            <div class="card-header">
              <h4 class="personality-name">{{ card.personality.name }}</h4>
              <span *ngIf="card.personality.isClassic" class="classic-badge">
                Classic
              </span>
            </div>

            <p class="personality-description">
              {{ card.personality.description }}
            </p>

            <div class="personality-tags">
              <span
                *ngFor="let tag of card.personality.tags.slice(0, 3)"
                class="tag"
              >
                {{ tag }}
              </span>
            </div>

            <div class="personality-meta">
              <span class="meta-item">
                <span class="meta-label">Colors:</span>
                {{ getHarmonyName(card.personality.colorHarmony.type) }}
              </span>
              <span class="meta-item">
                <span class="meta-label">Feel:</span>
                {{ card.personality.category }}
              </span>
            </div>
          </div>

          <!-- Selection Indicator -->
          <div class="selection-indicator" *ngIf="card.isSelected">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>
      </div>

      <!-- Selected Personality Info -->
      <div class="selected-info" *ngIf="selectedPersonality">
        <h4>Currently Selected: {{ selectedPersonality.name }}</h4>
        <p>{{ selectedPersonality.description }}</p>

        <div class="features-list">
          <div class="feature">
            <span class="feature-label">Typography:</span>
            <span class="feature-value">{{
              selectedPersonality.tokens.typography
            }}</span>
          </div>
          <div class="feature">
            <span class="feature-label">Spacing:</span>
            <span class="feature-value">{{
              selectedPersonality.tokens.spacingScale
            }}</span>
          </div>
          <div class="feature">
            <span class="feature-label">Border Radius:</span>
            <span class="feature-value">{{
              selectedPersonality.tokens.borderRadius
            }}</span>
          </div>
          <div class="feature">
            <span class="feature-label">Shadows:</span>
            <span class="feature-value">{{
              selectedPersonality.tokens.shadowIntensity
            }}</span>
          </div>
          <div class="feature">
            <span class="feature-label">Animation:</span>
            <span class="feature-value">{{
              selectedPersonality.animations.speed
            }}</span>
          </div>
          <div class="feature">
            <span class="feature-label">Icons:</span>
            <span class="feature-value">{{
              selectedPersonality.iconStyle
            }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .personality-selector {
        padding: var(--spacing-lg, 1.5rem);
        max-width: 1200px;
        margin: 0 auto;
        font-family: var(--font-body, system-ui, sans-serif);
      }

      .selector-header {
        text-align: center;
        margin-bottom: var(--spacing-xl, 2rem);

        h3 {
          margin: 0 0 var(--spacing-sm, 0.5rem);
          font-family: var(--font-heading, system-ui, sans-serif);
          font-size: var(--font-size-xl, 1.5rem);
          color: var(--foreground);
        }

        .subtitle {
          margin: 0;
          color: var(--muted);
          font-size: var(--font-size-sm, 0.9rem);
        }
      }

      .personalities-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: var(--spacing-md, 1rem);
        margin-bottom: var(--spacing-xl, 2rem);
      }

      .personality-card {
        position: relative;
        border: var(--border-width, 2px) solid var(--border);
        border-radius: var(--border-radius-lg, 8px);
        overflow: hidden;
        cursor: pointer;
        transition: all var(--animation-duration-normal, 0.2s) var(--animation-easing, ease);
        background: var(--surface);

        &:hover {
          border-color: var(--primary);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        &:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 20%, transparent);
        }

        &.selected {
          border-color: var(--primary);
          border-width: 3px;
          box-shadow: var(--shadow-lg);
        }
      }

      .card-preview {
        height: 100px;
        overflow: hidden;

        .preview-background {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background var(--animation-duration-normal, 0.3s) var(--animation-easing, ease);
        }

        .preview-elements {
          display: flex;
          align-items: center;
          gap: var(--spacing-md, 1rem);
        }

        .preview-accent {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          box-shadow: var(--shadow-md, 0 2px 8px rgba(0, 0, 0, 0.2));
        }

        .preview-text {
          font-size: var(--font-size-xl, 1.5rem);
          font-weight: 600;
          font-family: var(--font-heading, system-ui, sans-serif);
        }
      }

      .card-content {
        padding: var(--spacing-md, 1rem);
      }

      .card-header {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm, 0.5rem);
        margin-bottom: var(--spacing-sm, 0.5rem);

        .personality-name {
          margin: 0;
          font-family: var(--font-heading, system-ui, sans-serif);
          font-size: 1.1rem;
          color: var(--foreground);
        }

        .classic-badge {
          font-size: 0.7rem;
          padding: 0.15rem 0.4rem;
          background: var(--primary);
          color: var(--primary-foreground, white);
          border-radius: var(--border-radius-full, 999px);
          font-weight: 500;
        }
      }

      .personality-description {
        margin: 0 0 var(--spacing-sm, 0.75rem);
        font-size: var(--font-size-sm, 0.85rem);
        color: var(--muted);
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .personality-tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-xs, 0.25rem);
        margin-bottom: var(--spacing-sm, 0.75rem);

        .tag {
          font-size: 0.7rem;
          padding: 0.15rem 0.4rem;
          background: var(--background-elevated);
          color: var(--foreground-secondary);
          border-radius: var(--border-radius-sm, 2px);
          text-transform: capitalize;
          font-family: var(--font-body, system-ui, sans-serif);
        }
      }

      .personality-meta {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-sm, 0.75rem);
        font-size: 0.75rem;
        color: var(--muted);
        font-family: var(--font-body, system-ui, sans-serif);

        .meta-item {
          display: flex;
          gap: var(--spacing-xs, 0.25rem);
        }

        .meta-label {
          font-weight: 500;
        }
      }

      .selection-indicator {
        position: absolute;
        top: var(--spacing-sm, 0.5rem);
        right: var(--spacing-sm, 0.5rem);
        width: 24px;
        height: 24px;
        background: var(--primary);
        color: var(--primary-foreground, white);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;

        svg {
          width: 16px;
          height: 16px;
          stroke-width: 3;
        }
      }

      .selected-info {
        background: var(--surface);
        border: var(--border-width, 1px) solid var(--border);
        border-radius: var(--border-radius-lg, 8px);
        padding: var(--spacing-lg, 1.5rem);

        h4 {
          margin: 0 0 var(--spacing-sm, 0.5rem);
          font-family: var(--font-heading, system-ui, sans-serif);
          color: var(--foreground);
        }

        p {
          margin: 0 0 var(--spacing-md, 1rem);
          color: var(--muted);
        }

        .features-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: var(--spacing-sm, 0.5rem);
        }

        .feature {
          display: flex;
          justify-content: space-between;
          padding: var(--spacing-sm, 0.5rem);
          background: var(--background);
          border-radius: var(--border-radius-md, 4px);

          .feature-label {
            color: var(--muted);
            font-size: var(--font-size-sm, 0.85rem);
          }

          .feature-value {
            color: var(--foreground);
            font-size: var(--font-size-sm, 0.85rem);
            font-weight: 500;
            text-transform: capitalize;
          }
        }
      }

      @media (max-width: 640px) {
        .personalities-grid {
          grid-template-columns: 1fr;
        }

        .selected-info .features-list {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class PersonalitySelectorComponent implements OnInit, OnDestroy {
  personalities: Personality[] = PREDEFINED_PERSONALITIES;
  personalityCards: PersonalityCard[] = [];
  selectedPersonality: Personality | null = null;
  currentPrimaryColor = '#3f51b5';

  @Output() personalitySelected = new EventEmitter<Personality>();

  private destroy$ = new Subject<void>();

  constructor(private themeService: ThemeService) { }

  ngOnInit(): void {
    // Subscribe to current personality
    this.themeService.personality$
      .pipe(takeUntil(this.destroy$))
      .subscribe((personality) => {
        if (personality) {
          this.selectedPersonality = personality;
          this.updatePersonalityCards();
        }
      });

    // Subscribe to primary color changes
    this.themeService.generatedTheme$
      .pipe(takeUntil(this.destroy$))
      .subscribe((theme) => {
        if (theme) {
          this.currentPrimaryColor = theme.config.primaryColor;
          this.updatePersonalityCards();
        }
      });

    // Initialize cards
    this.updatePersonalityCards();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updatePersonalityCards(): void {
    this.personalityCards = this.personalities.map((personality) => ({
      personality,
      isSelected: this.selectedPersonality?.id === personality.id,
      previewColors: {
        light: [
          personality.modes.light.background.base,
          personality.modes.light.foreground.primary,
        ],
        dark: [
          personality.modes.dark.background.base,
          personality.modes.dark.foreground.primary,
        ],
      },
    }));
  }

  selectPersonality(personalityId: string): void {
    const personality = getPersonalityById(personalityId);
    if (personality) {
      this.themeService.setPersonality(personalityId);
      this.personalitySelected.emit(personality);
    }
  }

  getPrimaryColor(): string {
    return this.currentPrimaryColor;
  }

  getHarmonyName(type: string): string {
    const harmonyNames: Record<string, string> = {
      complementary: 'Complementary',
      triadic: 'Triadic',
      analogous: 'Analogous',
      'split-complementary': 'Split',
      tetradic: 'Tetradic',
    };
    return harmonyNames[type] || type;
  }
}
