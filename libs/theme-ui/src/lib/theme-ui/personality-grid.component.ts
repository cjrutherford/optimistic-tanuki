/**
 * Personality Grid Component (Workstream D2)
 *
 * Renders the SAME set of primitives — heading, body paragraph, button,
 * card, and text input — across every predefined personality, once in light
 * mode and once in dark mode, laid out as a comparison grid. This is the
 * "all 12 at a glance" review surface called for in
 * `docs/plans/2026-07-14-theme-personality-distinctiveness.md` (Workstream
 * D2): redundant-looking personalities or font-loading fallbacks should be
 * visible by eye across the grid, not just in the numeric distance matrix in
 * `docs/design-system/personalities.md`.
 *
 * Each cell computes its OWN CSS custom properties directly from the
 * personality registry using the same pure color/contrast/shadow pipeline
 * `ThemeService` uses internally (`generatePersonalityColors`,
 * `generateThemeResponsiveColors`, `ensureContrast`, `generateShadowColor`)
 * plus the personality's `presentation` contract for radius/shadow/font/
 * animation. This is deliberately independent of `ThemeService.setPersonality()`,
 * which mutates a single global `document.documentElement` — that can only
 * hold one personality/mode at a time, which is unusable for a grid that
 * needs 24 simultaneous personality×mode combinations on screen at once.
 * Reusing the same pure functions (rather than re-deriving values) keeps the
 * grid honest: what you see here is what `ThemeService` would actually emit
 * for that personality.
 */

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import {
  PREDEFINED_PERSONALITIES,
  Personality,
  ensureContrast,
  generatePersonalityColors,
  getSuggestedTextColor,
} from '@optimistic-tanuki/theme-models';
import {
  generateShadowColor,
  generateThemeResponsiveColors,
} from '@optimistic-tanuki/theme-lib';

export type PersonalityGridMode = 'light' | 'dark';

interface PersonalityGridCell {
  personality: Personality;
  mode: PersonalityGridMode;
  cssVars: Record<string, string>;
}

/**
 * Derives the CSS custom properties for a single grid cell from a
 * personality + mode, mirroring `ThemeService`'s pure color/contrast/shadow
 * pipeline but scoped to one element instead of `document.documentElement`.
 */
function buildCellCssVars(
  personality: Personality,
  mode: PersonalityGridMode,
  primaryColor: string
): Record<string, string> {
  const colors = generatePersonalityColors(
    primaryColor,
    personality.colorHarmony.type,
    personality.colorHarmony.saturationBoost,
    personality.colorHarmony.lightnessShift,
    personality.colorHarmony.accentSaturation,
    personality.colorHarmony.accentLightness
  );

  const themeColors = generateThemeResponsiveColors(
    primaryColor,
    personality.colorGeneration,
    mode
  );

  const foreground = personality.contrast.autoAdjust
    ? ensureContrast(
        themeColors.foreground,
        themeColors.background,
        personality.contrast.minimumRatio,
        'auto'
      )
    : themeColors.foreground;

  const shadowColor = generateShadowColor(
    primaryColor,
    personality.colorGeneration.shadowTint,
    mode
  );

  const primaryForeground = getSuggestedTextColor(colors.primary).color;
  const presentation = personality.presentation;
  const headingFamily =
    personality.fonts.heading?.family ?? personality.fonts.body.family;
  const headingWeights = personality.fonts.heading?.weights ?? [600];

  return {
    '--cell-background': themeColors.background,
    '--cell-foreground': foreground,
    '--cell-surface': themeColors.surface,
    '--cell-border': themeColors.border,
    '--cell-muted': themeColors.muted,
    '--cell-primary': colors.primary,
    '--cell-primary-foreground': primaryForeground,
    '--cell-shadow-color': shadowColor,
    '--cell-font-heading': headingFamily,
    '--cell-font-body': personality.fonts.body.family,
    '--cell-font-weight-heading': String(
      headingWeights[headingWeights.length - 1] ?? 600
    ),
    '--cell-line-height': String(personality.tokens.lineHeight),
    '--cell-letter-spacing': personality.tokens.letterSpacing,
    '--cell-border-radius': presentation?.border.radiusValue ?? '4px',
    '--cell-border-style': presentation?.border.styleValue ?? 'solid',
    '--cell-border-width': presentation?.border.widthValue ?? '1px',
    '--cell-box-shadow': presentation?.shadow.value ?? 'none',
    '--cell-transition': presentation?.animation.transition ?? 'all 200ms ease',
    '--cell-button-radius':
      presentation?.components.button.borderRadius ??
      presentation?.border.radiusValue ??
      '4px',
    '--cell-button-padding':
      presentation?.components.button.padding ?? '0.5rem 1rem',
    '--cell-button-weight': presentation?.components.button.fontWeight ?? '600',
    '--cell-button-transform':
      presentation?.components.button.textTransform ?? 'none',
    '--cell-card-radius':
      presentation?.components.card.borderRadius ??
      presentation?.border.radiusValue ??
      '8px',
    '--cell-card-padding': presentation?.components.card.padding ?? '1rem',
    '--cell-card-shadow':
      presentation?.components.card.boxShadow ??
      presentation?.shadow.value ??
      'none',
    '--cell-input-radius':
      presentation?.components.input.borderRadius ??
      presentation?.border.radiusValue ??
      '4px',
    '--cell-input-border-width':
      presentation?.components.input.borderWidth ??
      presentation?.border.widthValue ??
      '1px',
  };
}

@Component({
  selector: 'lib-personality-grid',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      *ngFor="let section of sections"
      class="personality-grid__section"
      [attr.data-mode]="section.mode"
    >
      <h2 class="personality-grid__section-title">
        {{ section.mode === 'dark' ? 'Dark mode' : 'Light mode' }}
      </h2>

      <div class="personality-grid__grid" role="list">
        <article
          *ngFor="let cell of section.cells; trackBy: trackByPersonalityId"
          class="personality-grid__cell"
          role="listitem"
          [attr.data-personality]="cell.personality.id"
          [attr.data-mode]="cell.mode"
          [style]="cell.cssVars"
        >
          <header class="personality-grid__cell-header">
            <h3 class="personality-grid__cell-title">
              {{ cell.personality.name }}
            </h3>
            <code class="personality-grid__cell-id">{{
              cell.personality.id
            }}</code>
          </header>

          <h4 class="personality-grid__heading">The quick brown fox</h4>
          <p class="personality-grid__body">
            Jumps over the lazy dog — body copy at this personality's real
            weight, line height, and letter spacing.
          </p>

          <div class="personality-grid__row">
            <button type="button" class="personality-grid__button">
              Take action
            </button>
            <div class="personality-grid__card">
              <strong>Card</strong>
              <span>radius + shadow</span>
            </div>
          </div>

          <input
            type="text"
            class="personality-grid__input"
            placeholder="Type something…"
          />
        </article>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .personality-grid__section {
        padding: 2rem;
        margin-bottom: 1rem;
      }

      .personality-grid__section[data-mode='light'] {
        background: #f1f5f9;
      }

      .personality-grid__section[data-mode='dark'] {
        background: #0b1120;
      }

      .personality-grid__section-title {
        margin: 0 0 1.25rem;
        font-family: system-ui, sans-serif;
        color: #0f172a;
      }

      .personality-grid__section[data-mode='dark']
        .personality-grid__section-title {
        color: #f8fafc;
      }

      .personality-grid__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 1rem;
      }

      .personality-grid__cell {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
        padding: 1.25rem;
        background: var(--cell-background);
        color: var(--cell-foreground);
        border: var(--cell-border-width) var(--cell-border-style)
          var(--cell-border);
        border-radius: var(--cell-border-radius);
        box-shadow: var(--cell-box-shadow);
        transition: var(--cell-transition);
        font-family: var(--cell-font-body);
        line-height: var(--cell-line-height);
        letter-spacing: var(--cell-letter-spacing);
      }

      .personality-grid__cell-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 0.5rem;
      }

      .personality-grid__cell-title {
        margin: 0;
        font-family: var(--cell-font-heading);
        font-weight: var(--cell-font-weight-heading);
        font-size: 1rem;
      }

      .personality-grid__cell-id {
        font-size: 0.7rem;
        color: var(--cell-muted);
        white-space: nowrap;
      }

      .personality-grid__heading {
        margin: 0;
        font-family: var(--cell-font-heading);
        font-weight: var(--cell-font-weight-heading);
        font-size: 1.35rem;
      }

      .personality-grid__body {
        margin: 0;
        font-size: 0.875rem;
      }

      .personality-grid__row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .personality-grid__button {
        border: none;
        cursor: pointer;
        font: inherit;
        background: var(--cell-primary);
        color: var(--cell-primary-foreground);
        border-radius: var(--cell-button-radius);
        padding: var(--cell-button-padding);
        font-weight: var(--cell-button-weight);
        text-transform: var(--cell-button-transform);
        transition: var(--cell-transition);
      }

      .personality-grid__card {
        flex: 1;
        min-width: 120px;
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        background: var(--cell-surface);
        border: 1px solid var(--cell-border);
        border-radius: var(--cell-card-radius);
        padding: var(--cell-card-padding);
        box-shadow: var(--cell-card-shadow);
        font-size: 0.8rem;
      }

      .personality-grid__input {
        font: inherit;
        color: var(--cell-foreground);
        background: var(--cell-background);
        border: var(--cell-input-border-width) solid var(--cell-border);
        border-radius: var(--cell-input-radius);
        padding: 0.5rem 0.75rem;
        transition: var(--cell-transition);
      }
    `,
  ],
})
export class PersonalityGridComponent {
  /** Which mode section(s) to render. Defaults to both, side by side. */
  @Input() modes: PersonalityGridMode[] = ['light', 'dark'];

  /**
   * Primary color used to seed every personality's color harmony. A single
   * shared primary keeps the comparison about the *personality*, not about
   * different brand colors.
   */
  @Input() primaryColor = '#3f51b5';

  /**
   * Optional explicit personality id list. Defaults to every predefined
   * personality so the grid is a true "all N at a glance" view.
   */
  @Input() personalityIds?: string[];

  protected get sections(): {
    mode: PersonalityGridMode;
    cells: PersonalityGridCell[];
  }[] {
    const personalities = this.resolvePersonalities();
    return this.modes.map((mode) => ({
      mode,
      cells: personalities.map((personality) => ({
        personality,
        mode,
        cssVars: buildCellCssVars(personality, mode, this.primaryColor),
      })),
    }));
  }

  private resolvePersonalities(): Personality[] {
    if (!this.personalityIds || this.personalityIds.length === 0) {
      return PREDEFINED_PERSONALITIES;
    }
    const ids = new Set(this.personalityIds);
    return PREDEFINED_PERSONALITIES.filter((p) => ids.has(p.id));
  }

  protected trackByPersonalityId(
    _index: number,
    cell: PersonalityGridCell
  ): string {
    return `${cell.personality.id}-${cell.mode}`;
  }
}
