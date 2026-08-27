/**
 * Personality Token Showcase Component (Workstream D4, 2026-07-18
 * personality-styles-refactor plan)
 *
 * A 12-across, mode-aware comparison surface for the three token
 * dimensions Phases 2-5b of that plan made genuinely vary per personality
 * but that `<lib-personality-grid>` (Workstream D2 of the 07-14 plan)
 * doesn't isolate on its own:
 *
 * - `shadow-profiles` — the 7 distinct `tokens.shadowProfile` shapes
 *   (`layered`/`diffuse`/`hard-offset`/`neon`/`technical`/`minimal`/
 *   `playful-drop`), tinted per `colorGeneration.shadowTint` and
 *   mode-scaled per `resolveShadowOpacity`, via the SAME
 *   `generatePersonalityShadows()` that produces the real `--shadow-*`
 *   tokens (Workstream B1/B2).
 * - `page-backgrounds` — each personality's `pageBackground` SVG pattern
 *   (Workstream C1), rendered through the same encode step
 *   `ThemeService` uses post-C0 fix (`encodeURIComponent` + a single `'`
 *   replace, NOT the old double-escaping bug). `classic`/`foundation` have
 *   no `pageBackground` and are labeled "flat by design" rather than
 *   rendered as a (nonexistent) empty pattern.
 * - `surfaces` — `background` vs `surface` (the real
 *   `generateThemeResponsiveColors()` output, carrying Workstream E1's
 *   `surfaceHueBias`/`surfaceSaturationShift` character) vs an `elevated`
 *   tier. There is no separate `--elevated` production token today
 *   (`--background-elevated` is currently emitted as an alias of
 *   `surface` — see `theme.service.ts`); `elevated` here is a SECOND call
 *   to the same generator with `surfaceLuminosityOffset` doubled, i.e. "a
 *   surface lifted again", which is exactly what Workstream E1's doc
 *   comment means by "elevation contrast is itself a personality trait" —
 *   a demonstration built from the real derivation chain, not a
 *   hand-authored color. The `surface` tile also renders the personality's
 *   `surfaceTexture` (Workstream C3), if it has one, through the SAME
 *   `generatePageBackgroundPattern` + encode path as `--surface-texture` in
 *   `ThemeService` — most personalities have none, so most `surface` tiles
 *   render flat.
 *
 * Like `<lib-personality-grid>`, this deliberately does NOT use the global
 * Storybook personality/mode toolbar (`lib-storybook-theme-bridge`) or
 * `ThemeService.setPersonality()` (which mutates a single global
 * `document.documentElement` and can only hold one personality/mode at a
 * time). Each cell instead calls the same pure functions `ThemeService`
 * uses internally, scoped to its own inline style object, so 24
 * simultaneous personality x mode combinations can render side by side and
 * still be provably "what `ThemeService` would actually emit."
 */

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import {
  ColorGenerationConfig,
  ensureContrast,
  Personality,
  PREDEFINED_PERSONALITIES,
} from '@optimistic-tanuki/theme-models';
import {
  generatePageBackgroundPattern,
  generatePersonalityShadows,
  generateShadowTintColor,
  generateThemeResponsiveColors,
  resolveShadowOpacity,
} from '@optimistic-tanuki/theme-lib';

export type TokenShowcaseMode = 'light' | 'dark';
export type TokenShowcaseVariant =
  | 'shadow-profiles'
  | 'page-backgrounds'
  | 'surfaces';

interface TokenShowcaseCell {
  personality: Personality;
  mode: TokenShowcaseMode;
  cssVars: Record<string, string>;
  /** Short human-readable caption shown under the personality name. */
  caption: string;
  /** `page-backgrounds` only: true for the two documented flat personalities. */
  flat?: boolean;
}

/**
 * Encodes an SVG pattern as a `url("data:image/svg+xml,...")` background
 * image the SAME way `ThemeService` does post-C0 fix: `encodeURIComponent`
 * already escapes everything `url("...")` needs except `'`, so only that
 * one character gets a manual replace. (The pre-C0 bug re-escaped every
 * percent sign the encoder had just produced — do not reintroduce that
 * five-way `.replace()` chain here.)
 */
function encodeSvgBackground(svg: string): string {
  const encoded = encodeURIComponent(svg).replace(/'/g, '%27');
  return `url("data:image/svg+xml,${encoded}")`;
}

function buildShadowProfileCell(
  personality: Personality,
  mode: TokenShowcaseMode,
  primaryColor: string
): TokenShowcaseCell {
  const shadowTintRgb = generateShadowTintColor(
    primaryColor,
    personality.colorGeneration.shadowTint,
    mode
  );
  const shadowOpacity = resolveShadowOpacity(
    personality.colorGeneration.shadowOpacity,
    mode
  );
  const shadows = generatePersonalityShadows(
    personality,
    shadowTintRgb,
    shadowOpacity,
    primaryColor
  );
  const themeColors = generateThemeResponsiveColors(
    primaryColor,
    personality.colorGeneration,
    mode,
    personality.contrast.minimumRatio
  );
  const foreground = personality.contrast.autoAdjust
    ? ensureContrast(
        themeColors.foreground,
        themeColors.surface,
        personality.contrast.minimumRatio,
        'auto'
      )
    : themeColors.foreground;

  return {
    personality,
    mode,
    cssVars: {
      '--cell-background': themeColors.background,
      '--cell-surface': themeColors.surface,
      '--cell-foreground': foreground,
      '--cell-border': themeColors.border,
      '--cell-shadow-sm': shadows.sm,
      '--cell-shadow-md': shadows.md,
      '--cell-shadow-lg': shadows.lg,
      '--cell-border-radius':
        personality.presentation?.border.radiusValue ?? '8px',
    },
    caption: `${personality.tokens.shadowProfile} · ${personality.colorGeneration.shadowTint}`,
  };
}

function buildPageBackgroundCell(
  personality: Personality,
  mode: TokenShowcaseMode,
  primaryColor: string
): TokenShowcaseCell {
  const themeColors = generateThemeResponsiveColors(
    primaryColor,
    personality.colorGeneration,
    mode,
    personality.contrast.minimumRatio
  );
  const flat = !personality.pageBackground;
  let backgroundImage = 'none';
  if (personality.pageBackground) {
    const svg = generatePageBackgroundPattern(
      primaryColor,
      personality.pageBackground.pattern,
      personality.pageBackground.usePrimaryTint,
      personality.colorGeneration.pageBackgroundOpacity,
      mode
    );
    backgroundImage = encodeSvgBackground(svg);
  }

  return {
    personality,
    mode,
    cssVars: {
      '--cell-background': themeColors.background,
      '--cell-foreground': themeColors.foreground,
      '--cell-border': themeColors.border,
      '--cell-background-image': backgroundImage,
    },
    caption: flat
      ? 'flat by design'
      : `opacity ${personality.colorGeneration.pageBackgroundOpacity}`,
    flat,
  };
}

function buildSurfaceCell(
  personality: Personality,
  mode: TokenShowcaseMode,
  primaryColor: string
): TokenShowcaseCell {
  const themeColors = generateThemeResponsiveColors(
    primaryColor,
    personality.colorGeneration,
    mode,
    personality.contrast.minimumRatio
  );
  // "Elevated" demo tier: re-run the SAME generator with the personality's
  // OWN surfaceLuminosityOffset doubled — a surface lifted again, not a
  // hand-authored color. Shows why a personality with a wide offset (e.g.
  // playful's -7) reads as dramatically more "layered" than one with a
  // narrow offset (e.g. minimal's -1).
  const elevatedParams: ColorGenerationConfig = {
    ...personality.colorGeneration,
    surfaceLuminosityOffset:
      personality.colorGeneration.surfaceLuminosityOffset * 2,
  };
  const elevatedColors = generateThemeResponsiveColors(
    primaryColor,
    elevatedParams,
    mode,
    personality.contrast.minimumRatio
  );
  const foreground = personality.contrast.autoAdjust
    ? ensureContrast(
        themeColors.foreground,
        themeColors.background,
        personality.contrast.minimumRatio,
        'auto'
      )
    : themeColors.foreground;

  // Surface texture (Workstream C3): most personalities declare none, so
  // most `surface` tiles fall back to `none` and render flat. The curated
  // few (soft-touch, control-center, architect, electric) render their
  // texture through the exact same generator + encode path ThemeService
  // uses for `--surface-texture`.
  let surfaceTextureImage = 'none';
  if (personality.surfaceTexture) {
    const svg = generatePageBackgroundPattern(
      primaryColor,
      personality.surfaceTexture.pattern,
      personality.surfaceTexture.usePrimaryTint,
      personality.surfaceTexture.opacity,
      mode
    );
    surfaceTextureImage = encodeSvgBackground(svg);
  }

  return {
    personality,
    mode,
    cssVars: {
      '--cell-background': themeColors.background,
      '--cell-surface': themeColors.surface,
      '--cell-elevated': elevatedColors.surface,
      '--cell-foreground': foreground,
      '--cell-border': themeColors.border,
      '--cell-surface-texture': surfaceTextureImage,
    },
    caption: `${personality.colorGeneration.surfaceHueBias} · Δsat ${personality.colorGeneration.surfaceSaturationShift} · offset ${personality.colorGeneration.surfaceLuminosityOffset}`,
  };
}

@Component({
  selector: 'lib-personality-token-showcase',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      *ngFor="let section of sections"
      class="token-showcase__section"
      [attr.data-mode]="section.mode"
    >
      <h2 class="token-showcase__section-title">
        {{ section.mode === 'dark' ? 'Dark mode' : 'Light mode' }}
      </h2>

      <div class="token-showcase__grid" role="list">
        <article
          *ngFor="let cell of section.cells; trackBy: trackByPersonalityId"
          class="token-showcase__cell"
          [class.token-showcase__cell--flat]="cell.flat"
          role="listitem"
          [attr.data-personality]="cell.personality.id"
          [attr.data-mode]="cell.mode"
          [style]="cell.cssVars"
        >
          <header class="token-showcase__cell-header">
            <strong>{{ cell.personality.name }}</strong>
            <code>{{ cell.personality.id }}</code>
          </header>
          <p class="token-showcase__cell-caption">{{ cell.caption }}</p>

          <ng-container [ngSwitch]="variant">
            <div
              *ngSwitchCase="'shadow-profiles'"
              class="token-showcase__shadow-swatch"
            >
              <div class="token-showcase__shadow-swatch-inner">Shadow</div>
            </div>

            <div
              *ngSwitchCase="'page-backgrounds'"
              class="token-showcase__background-swatch"
            >
              <span *ngIf="cell.flat" class="token-showcase__flat-label"
                >flat by design</span
              >
            </div>

            <div *ngSwitchCase="'surfaces'" class="token-showcase__surface-row">
              <div class="token-showcase__surface-tile" data-tier="background">
                background
              </div>
              <div class="token-showcase__surface-tile" data-tier="surface">
                surface
              </div>
              <div class="token-showcase__surface-tile" data-tier="elevated">
                elevated
              </div>
            </div>
          </ng-container>
        </article>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .token-showcase__section {
        padding: 2rem;
        margin-bottom: 1rem;
      }

      .token-showcase__section[data-mode='light'] {
        background: #f1f5f9;
      }

      .token-showcase__section[data-mode='dark'] {
        background: #0b1120;
      }

      .token-showcase__section-title {
        margin: 0 0 1.25rem;
        font-family: system-ui, sans-serif;
        color: #0f172a;
      }

      .token-showcase__section[data-mode='dark']
        .token-showcase__section-title {
        color: #f8fafc;
      }

      .token-showcase__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 1rem;
      }

      .token-showcase__cell {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
        padding: 1.25rem;
        background: var(--cell-background);
        color: var(--cell-foreground);
        border: 1px solid var(--cell-border);
        border-radius: var(--cell-border-radius, 8px);
        font-family: system-ui, sans-serif;
      }

      .token-showcase__cell-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 0.5rem;
        font-size: 0.9rem;
      }

      .token-showcase__cell-header code {
        font-size: 0.7rem;
        opacity: 0.7;
      }

      .token-showcase__cell-caption {
        margin: 0;
        font-size: 0.72rem;
        opacity: 0.75;
      }

      /* --- shadow-profiles --- */
      .token-showcase__shadow-swatch {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem 1rem;
      }

      .token-showcase__shadow-swatch-inner {
        width: 100%;
        padding: 1.25rem;
        text-align: center;
        font-size: 0.8rem;
        background: var(--cell-surface);
        border-radius: var(--cell-border-radius, 8px);
        box-shadow: var(--cell-shadow-md);
      }

      /* --- page-backgrounds --- */
      .token-showcase__background-swatch {
        position: relative;
        height: 140px;
        border-radius: 6px;
        border: 1px solid var(--cell-border);
        background-color: var(--cell-background);
        background-image: var(--cell-background-image, none);
        background-repeat: repeat;
        background-position: center;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .token-showcase__flat-label {
        font-size: 0.72rem;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        opacity: 0.6;
      }

      /* --- surfaces --- */
      .token-showcase__surface-row {
        display: flex;
        gap: 0.5rem;
      }

      .token-showcase__surface-tile {
        flex: 1;
        height: 72px;
        display: flex;
        align-items: flex-end;
        padding: 0.4rem;
        font-size: 0.65rem;
        border-radius: 6px;
        border: 1px solid var(--cell-border);
      }

      .token-showcase__surface-tile[data-tier='background'] {
        background: var(--cell-background);
      }

      .token-showcase__surface-tile[data-tier='surface'] {
        background-color: var(--cell-surface);
        background-image: var(--cell-surface-texture, none);
        background-repeat: repeat;
      }

      .token-showcase__surface-tile[data-tier='elevated'] {
        background: var(--cell-elevated);
      }
    `,
  ],
})
export class PersonalityTokenShowcaseComponent {
  /** Which token dimension to render. */
  @Input() variant: TokenShowcaseVariant = 'shadow-profiles';

  /** Which mode section(s) to render. Defaults to both, side by side. */
  @Input() modes: TokenShowcaseMode[] = ['light', 'dark'];

  /**
   * Primary color used to seed every personality's derivation. A single
   * shared primary keeps the comparison about the *personality*, not about
   * different brand colors.
   */
  @Input() primaryColor = '#3f51b5';

  /**
   * Optional explicit personality id list. Defaults to every predefined
   * personality so the grid is a true "all 12 at a glance" view.
   */
  @Input() personalityIds?: string[];

  protected get sections(): {
    mode: TokenShowcaseMode;
    cells: TokenShowcaseCell[];
  }[] {
    const personalities = this.resolvePersonalities();
    return this.modes.map((mode) => ({
      mode,
      cells: personalities.map((personality) =>
        this.buildCell(personality, mode)
      ),
    }));
  }

  private buildCell(
    personality: Personality,
    mode: TokenShowcaseMode
  ): TokenShowcaseCell {
    switch (this.variant) {
      case 'page-backgrounds':
        return buildPageBackgroundCell(personality, mode, this.primaryColor);
      case 'surfaces':
        return buildSurfaceCell(personality, mode, this.primaryColor);
      case 'shadow-profiles':
      default:
        return buildShadowProfileCell(personality, mode, this.primaryColor);
    }
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
    cell: TokenShowcaseCell
  ): string {
    return `${cell.personality.id}-${cell.mode}`;
  }
}
