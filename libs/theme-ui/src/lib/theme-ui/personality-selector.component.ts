/**
 * Personality Selector Component for the deferred personality picker.
 * Each card previews its personality in that personality's own look.
 */

import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Personality,
  ThemeService,
  FontLoadingService,
} from '@optimistic-tanuki/theme-lib';
import { IconComponent, IconName } from '@optimistic-tanuki/common-ui';
import { Subject, takeUntil } from 'rxjs';
import {
  buildPersonalityPreviewVars,
  personalityIcon,
  PersonalityPreviewMode,
} from './personality-card-preview';

interface GroupedPersonality {
  category: string;
  personalities: Personality[];
}

@Component({
  selector: 'lib-personality-selector',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="personality-overlay-container">
      <div class="overlay-header">
        <div class="header-text">
          <h2 class="overlay-title" [id]="titleId || null">
            Choose Your Style
          </h2>
          <p class="overlay-subtitle" *ngIf="currentPersonality">
            Current: <strong>{{ currentPersonality.name }}</strong>
          </p>
        </div>
        <button
          class="close-button"
          (click)="onClose.emit()"
          aria-label="Close"
          type="button"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="overlay-content">
        <div
          class="personality-groups"
          role="radiogroup"
          aria-label="Personality style"
        >
          <section
            *ngFor="let group of groupedPersonalities"
            class="personality-group"
            role="group"
            [attr.aria-labelledby]="'ps-group-' + group.category"
          >
            <h3 class="group-label" [id]="'ps-group-' + group.category">
              {{ getCategoryLabel(group.category) }}
              <span class="group-count">{{ group.personalities.length }}</span>
            </h3>
            <div class="personality-options">
              <button
                *ngFor="let personality of group.personalities"
                class="personality-option"
                [class.selected]="isSelected(personality)"
                [attr.data-personality]="personality.id"
                role="radio"
                [attr.aria-checked]="isSelected(personality)"
                [attr.tabindex]="tabIndexFor(personality)"
                (click)="selectPersonality(personality)"
                (keydown)="onCardKeydown($event, personality)"
                type="button"
              >
                <span
                  class="preview"
                  aria-hidden="true"
                  [style]="previewVars(personality)"
                >
                  <span class="pv-copy">
                    <span class="pv-aa">Aa</span>
                    <span class="pv-name">{{ personality.name }}</span>
                    <span class="pv-body">Quick brown fox jumps</span>
                    <span class="pv-dots"
                      ><i class="pv-dot pv-dot--p"></i
                      ><i class="pv-dot pv-dot--s"></i
                      ><i class="pv-dot pv-dot--t"></i
                    ></span>
                  </span>
                  <span class="pv-surface">
                    <span class="pv-line"></span>
                    <span class="pv-line pv-line--short"></span>
                    <span class="pv-button">Apply</span>
                  </span>
                </span>
                <span class="option-content">
                  <span class="option-name">
                    <otui-icon
                      [name]="getPersonalityIcon(personality)"
                      [size]="18"
                      stroke="currentColor"
                      aria-hidden="true"
                    ></otui-icon>
                    <span class="option-title">{{ personality.name }}</span>
                    <span *ngIf="personality.isClassic" class="tag"
                      >Classic</span
                    >
                    <span
                      *ngIf="isSelected(personality)"
                      class="tag tag--current"
                      ><otui-icon
                        name="check"
                        [size]="12"
                        [strokeWidth]="3"
                        stroke="currentColor"
                        aria-hidden="true"
                      ></otui-icon
                      >Current</span
                    >
                  </span>
                  <span class="option-description">{{
                    personality.description
                  }}</span>
                </span>
              </button>
            </div>
          </section>
        </div>
      </div>

      <div class="overlay-footer">
        <p class="hint">
          {{
            applyOnSelect
              ? 'Pick a style to apply it instantly. Arrow keys move between styles.'
              : 'Pick a style to preview it. Arrow keys move between styles.'
          }}
        </p>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      .personality-overlay-container {
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        background: var(--surface, #ffffff);
        color: var(--foreground, #171717);
        border: var(--border-width, 1px) solid var(--primary);
        border-radius: var(--border-radius-lg, 12px);
        box-shadow: var(--shadow-xl, 0 25px 50px -12px rgba(0, 0, 0, 0.25));
        width: 100%;
        max-width: 100%;
        max-height: 100%;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
        font-family: var(--font-body, system-ui, sans-serif);
      }

      .overlay-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
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
        letter-spacing: 0.02em;
      }

      .overlay-subtitle {
        margin: 2px 0 0;
        font-size: 0.8125rem;
      }

      .close-button {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        width: 40px;
        height: 40px;
        padding: 0;
        background: transparent;
        border: 2px solid var(--primary-foreground, #ffffff);
        color: var(--primary-foreground, #ffffff);
        cursor: pointer;
        border-radius: var(--border-radius-sm, 4px);

        &:hover {
          background: var(--primary-foreground, #ffffff);
          color: var(--primary);
        }

        &:focus-visible {
          outline: 2px solid var(--primary-foreground, #ffffff);
          outline-offset: 3px;
        }

        svg {
          width: 20px;
          height: 20px;
        }
      }

      .overlay-content {
        flex: 1;
        min-width: 0;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        padding: var(--spacing-md, 16px) var(--spacing-lg, 24px);
        overscroll-behavior: contain;
        scroll-padding-block: 16px;
        scrollbar-gutter: stable;
        -webkit-overflow-scrolling: touch;
        touch-action: pan-y;
      }

      .personality-groups {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .group-label {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 0 0 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--border, #e5e7eb);
        font-family: var(--font-heading, system-ui, sans-serif);
        font-size: 0.8125rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--foreground, #171717);
      }

      .group-count {
        font-family: var(--font-body, system-ui, sans-serif);
        font-size: 0.6875rem;
        font-weight: 600;
        letter-spacing: 0;
        padding: 1px 8px;
        border-radius: 9999px;
        background: color-mix(
          in srgb,
          var(--foreground, #171717) 10%,
          transparent
        );
      }

      .personality-options {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
        gap: 14px;
      }

      .personality-option {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 0;
        padding: 8px 8px 12px;
        background: color-mix(
          in srgb,
          var(--foreground, #171717) 4%,
          var(--surface, #fff)
        );
        color: var(--foreground, #171717);
        border: 2px solid var(--border, #d4d4d8);
        border-radius: var(--border-radius-md, 10px);
        cursor: pointer;
        text-align: left;
        font: inherit;
        transition: border-color 120ms ease, transform 120ms ease,
          box-shadow 120ms ease;

        &:hover {
          border-color: var(--primary);
          transform: translateY(-2px);
        }

        &:focus-visible {
          outline: 3px solid var(--focus-ring-color, var(--foreground, #171717));
          outline-offset: 3px;
          box-shadow: var(--glow-focus, none);
        }

        &.selected {
          border-color: var(--primary);
          box-shadow: 0 0 0 2px var(--primary);
          background: color-mix(
            in srgb,
            var(--primary) 10%,
            var(--surface, #fff)
          );
        }
      }

      /* Mini preview: scoped --pv-* variables from the personality itself. */
      .preview {
        display: flex;
        align-items: stretch;
        gap: 10px;
        min-height: 128px;
        padding: 12px;
        background-color: var(--pv-bg);
        background-image: var(--pv-pattern);
        color: var(--pv-fg);
        border: var(--pv-border-width) var(--pv-border-style) var(--pv-border);
        border-radius: var(--pv-card-radius);
        overflow: hidden;
        font-family: var(--pv-font-body), system-ui, sans-serif;
      }

      .pv-copy {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        flex: 1 1 0;
        min-width: 0;
      }

      .pv-aa {
        font-family: var(--pv-font-heading), system-ui, sans-serif;
        font-weight: var(--pv-heading-weight);
        font-size: 2.1rem;
        line-height: 1;
        color: var(--pv-fg);
        text-decoration: underline solid var(--pv-primary) 3px;
        text-underline-offset: 4px;
      }

      .pv-name {
        font-family: var(--pv-font-heading), system-ui, sans-serif;
        font-weight: var(--pv-heading-weight);
        font-size: 0.95rem;
        line-height: 1.2;
        overflow-wrap: anywhere;
      }

      .pv-body {
        font-size: 0.75rem;
        line-height: 1.3;
      }

      .pv-dots {
        display: flex;
        gap: 4px;
      }

      .pv-dot {
        width: 12px;
        height: 12px;
        border-radius: var(--pv-radius);
        background: var(--pv-primary);
        border: 1px solid var(--pv-border);
      }

      .pv-dot--s {
        background: var(--pv-secondary);
      }

      .pv-dot--t {
        background: var(--pv-tertiary);
      }

      .pv-surface {
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        gap: 6px;
        flex: 0 0 46%;
        padding: 10px;
        background: var(--pv-surface);
        border: var(--pv-border-width) var(--pv-border-style) var(--pv-border);
        border-radius: var(--pv-card-radius);
        box-shadow: var(--pv-card-shadow);
      }

      .pv-line {
        display: block;
        height: 5px;
        border-radius: 3px;
        background: var(--pv-fg);
        opacity: 0.45;
      }

      .pv-line--short {
        width: 60%;
      }

      .pv-button {
        display: block;
        margin-top: 4px;
        padding: 5px 8px;
        background: var(--pv-primary);
        color: var(--pv-primary-fg);
        border-radius: var(--pv-button-radius);
        font-family: var(--pv-font-body), system-ui, sans-serif;
        font-weight: var(--pv-button-weight);
        text-transform: var(--pv-button-transform);
        font-size: 0.75rem;
        line-height: 1.2;
        text-align: center;
      }

      .option-content {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        padding: 0 4px;
      }

      .option-name {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        font-family: var(--font-heading, system-ui, sans-serif);
        font-size: 0.9375rem;
        font-weight: 700;
      }

      .option-title {
        overflow-wrap: anywhere;
      }

      .tag {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 1px 8px;
        border: 1px solid currentColor;
        border-radius: 9999px;
        font-family: var(--font-body, system-ui, sans-serif);
        font-size: 0.6875rem;
        font-weight: 600;
        letter-spacing: 0.03em;
      }

      .tag--current {
        background: var(--primary);
        border-color: var(--primary);
        color: var(--primary-foreground, #ffffff);
      }

      .option-description {
        font-size: 0.8125rem;
        line-height: 1.4;
        color: var(--foreground-secondary, var(--foreground, #404040));
        opacity: 0.9;
      }

      .overlay-footer {
        padding: 10px var(--spacing-lg, 24px);
        border-top: 1px solid var(--border, #e5e7eb);
        flex-shrink: 0;
      }

      .hint {
        margin: 0;
        font-size: 0.75rem;
        color: var(--foreground-secondary, var(--foreground, #404040));
        text-align: center;
      }

      @media (max-width: 520px) {
        .overlay-content {
          padding: 12px;
        }
        .personality-options {
          grid-template-columns: 1fr;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .personality-option {
          transition: none;
        }
        .personality-option:hover {
          transform: none;
        }
      }
    `,
  ],
})
export class PersonalitySelectorComponent implements OnInit, OnDestroy {
  /** Personalities to offer. Left empty, the theme service's list is used. */
  @Input() personalities: Personality[] = [];
  /** Highlighted personality. Left empty, the active personality is used. */
  @Input() currentPersonality: Personality | null = null;
  /**
   * Apply the selection through the theme service. Hosts that apply it
   * themselves set this to false and handle `personalitySelected`.
   */
  @Input() applyOnSelect = true;
  @Input() titleId = '';
  @Output() personalitySelected = new EventEmitter<Personality>();
  @Output() onClose = new EventEmitter<void>();

  groupedPersonalities: GroupedPersonality[] = [];
  currentPrimaryColor = '#3f51b5';
  mode: PersonalityPreviewMode = 'light';

  private destroy$ = new Subject<void>();
  private varsCache = new Map<string, Record<string, string>>();
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private fonts = inject(FontLoadingService, { optional: true });

  constructor(private themeService: ThemeService) {}

  ngOnInit(): void {
    if (this.personalities.length) {
      this.groupPersonalities();
    } else {
      this.themeService.availablePersonalities$
        .pipe(takeUntil(this.destroy$))
        .subscribe((personalities) => {
          this.personalities = personalities;
          this.groupPersonalities();
        });
    }

    this.currentPersonality ??= this.themeService.getCurrentPersonality();
    this.themeService.personality$
      .pipe(takeUntil(this.destroy$))
      .subscribe((personality) => {
        if (personality) {
          this.currentPersonality = personality;
        }
      });

    this.themeService.generatedTheme$
      .pipe(takeUntil(this.destroy$))
      .subscribe((theme) => {
        if (theme) {
          this.currentPrimaryColor = theme.config.primaryColor;
          this.varsCache.clear();
        }
      });

    this.themeService
      .theme$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((mode) => {
        this.mode = mode === 'dark' ? 'dark' : 'light';
        this.varsCache.clear();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** CSS variables for one card's preview, in that personality's own look. */
  previewVars(personality: Personality): Record<string, string> {
    let vars = this.varsCache.get(personality.id);
    if (!vars) {
      vars = buildPersonalityPreviewVars(
        personality,
        this.mode,
        this.currentPrimaryColor
      );
      this.varsCache.set(personality.id, vars);
    }
    return vars;
  }

  getPersonalityIcon(personality: Personality): IconName {
    return personalityIcon(personality);
  }

  isSelected(personality: Personality): boolean {
    return personality.id === this.currentPersonality?.id;
  }

  /** Roving tabindex: the selected card (or the first) is the tab stop. */
  tabIndexFor(personality: Personality): number {
    const all = this.personalities;
    const anchor = all.some((p) => this.isSelected(p))
      ? this.currentPersonality?.id
      : all[0]?.id;
    return personality.id === anchor ? 0 : -1;
  }

  onCardKeydown(event: KeyboardEvent, personality: Personality): void {
    const flat = this.groupedPersonalities.flatMap((g) => g.personalities);
    const index = flat.findIndex((p) => p.id === personality.id);
    const cards = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>(
        '.personality-option'
      )
    );
    const cols = Math.max(
      1,
      getComputedStyle(
        cards[index]?.parentElement ?? document.body
      ).gridTemplateColumns.split(' ').length
    );
    const step: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: cols,
      ArrowUp: -cols,
    };
    let next = -1;
    if (event.key in step) {
      next = Math.min(flat.length - 1, Math.max(0, index + step[event.key]));
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = flat.length - 1;
    }
    if (next < 0) return;
    event.preventDefault();
    const target = cards[next];
    cards.forEach((c, i) =>
      c.setAttribute('tabindex', i === next ? '0' : '-1')
    );
    target?.focus();
  }

  private groupPersonalities(): void {
    const groups: Record<string, Personality[]> = {};

    for (const personality of this.personalities) {
      (groups[personality.category] ??= []).push(personality);
    }

    this.groupedPersonalities = Object.entries(groups).map(
      ([category, personalities]) => ({
        category,
        personalities,
      })
    );
    this.loadFonts();
  }

  /** Load each personality's fonts so previews render in them; failures fall back. */
  private loadFonts(): void {
    if (!this.fonts) return;
    for (const personality of this.personalities) {
      void this.fonts.loadPersonalityFonts(personality).catch(() => undefined);
    }
  }

  selectPersonality(personality: Personality): void {
    this.currentPersonality = personality;
    if (this.applyOnSelect) {
      void this.themeService.setPersonality(personality.id);
    }
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
