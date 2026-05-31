import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import type { ThemeConfig } from '@optimistic-tanuki/app-config-models';

const CUSTOM_CSS_STYLE_ID = 'tenant-custom-theme-css';

/**
 * Hard cap on `customCss` length. Anything longer than this is rejected
 * outright; it is far beyond what any legitimate per-tenant theme needs
 * and shrinks the surface area for CSS-injection denial-of-service.
 */
const CUSTOM_CSS_MAX_LENGTH = 20_000;

/**
 * Patterns that are unconditionally forbidden inside `customCss`. These
 * cover the highest-impact CSS-injection vectors:
 *
 * - `@import` / `@font-face` / `@charset` — load arbitrary remote
 *   resources, enable side-channel exfiltration via `url(...)`.
 * - `position: fixed|sticky|absolute` — UI-redress / click-jacking
 *   overlays that hijack the document.
 * - `content:` — used to overlay or replace trusted chrome text.
 * - `url(...)` to anything other than `data:image/...` — both a network
 *   side channel and a way to load remote fonts/images for tracking.
 * - Attribute selectors that read form-control values (`[name=...]`,
 *   `[value^=...]`, etc.) — the canonical CSS exfiltration primitive.
 * - `expression(...)` / `javascript:` / `vbscript:` — legacy script
 *   execution channels still parsed by some engines/extensions.
 * - `z-index` ≥ 1000 — defense in depth against full-page overlays
 *   even when `position` is filtered out by transforms or `inset`.
 *
 * This is a deliberate denylist, not an allowlist; it is proportionate
 * to the immediate threat but not a substitute for an AST-based
 * sanitizer or a sandboxed style scope. See README / cross-F plan doc.
 */
const FORBIDDEN_CUSTOM_CSS_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  reason: string;
}> = [
  { pattern: /@import\b/i, reason: '@import is forbidden' },
  { pattern: /@font-face\b/i, reason: '@font-face is forbidden' },
  { pattern: /@charset\b/i, reason: '@charset is forbidden' },
  {
    pattern: /position\s*:\s*(fixed|sticky|absolute)/i,
    reason: 'positioned overlays are forbidden',
  },
  { pattern: /\bcontent\s*:/i, reason: 'content: is forbidden' },
  {
    pattern: /url\s*\(\s*(?!['"]?data:image\/)/i,
    reason: 'url() to non-data:image sources is forbidden',
  },
  {
    pattern: /\[\s*(name|value|type|placeholder|aria-[a-z-]+)\s*[~|^$*]?=/i,
    reason: 'attribute selectors on form/data attributes are forbidden',
  },
  { pattern: /expression\s*\(/i, reason: 'expression() is forbidden' },
  { pattern: /javascript\s*:/i, reason: 'javascript: URIs are forbidden' },
  { pattern: /vbscript\s*:/i, reason: 'vbscript: URIs are forbidden' },
  {
    pattern: /z-index\s*:\s*(?:[1-9]\d{3,}|9{3,})/i,
    reason: 'z-index ≥ 1000 is forbidden',
  },
];

/**
 * Maps a tenant `ThemeConfig` (from `AppConfiguration.theme`) onto the
 * workspace `ThemeService` palette tokens.
 *
 * Mapping strategy (applied in this exact order on the browser):
 * 1. `setTheme(mode)`                     — defaults to `'light'`.
 * 2. `await setPersonality(personalityId)` — defaults to `'foundation'`.
 *    Awaited because `setPersonality` is async (font loading) and its
 *    `generateAndApplyPersonalityTheme()` writes `--primary`,
 *    `--secondary`, `--background`, `--foreground`, `--font-body`, …
 *    If we did not await, those writes would land in a later microtask
 *    and clobber the explicit tenant overrides below.
 * 3. `setPrimaryColor(primaryColor)`      — defaults to `'#356c91'`.
 *    Synchronously re-runs `generateAndApplyPersonalityTheme()` with
 *    the new primary, so the personality palette is now aligned with
 *    the tenant brand primary.
 * 4. Explicit tenant overrides for `secondaryColor`/`backgroundColor`/
 *    `textColor`/`fontFamily` — written directly to the canonical
 *    ThemeService output tokens (`--secondary`, `--background`,
 *    `--foreground`, `--font-body`) so they deterministically win
 *    against the personality-generated palette computed in step 3.
 * 5. `customCss` — sanitized (denylist + length cap) and injected into
 *    a singleton `<style id="tenant-custom-theme-css">` element.
 *
 * Caller MUST `await` `apply()` if it needs the DOM to reflect the
 * tenant theme before continuing (the standard case).
 *
 * No-op on the server (SSR). When `theme` is `null`/`undefined` the
 * documented foundation defaults are still applied so the configurable
 * client renders correctly even before HTTP returns or when the
 * configured tenant supplies no theme block.
 */
@Injectable({ providedIn: 'root' })
export class TenantThemeService {
  /** Workspace defaults applied when the tenant config omits a field. */
  static readonly DEFAULT_PERSONALITY = 'foundation';
  static readonly DEFAULT_PRIMARY_COLOR = '#356c91';
  static readonly DEFAULT_MODE: 'light' | 'dark' = 'light';

  constructor(
    private readonly themeService: ThemeService,
    @Inject(PLATFORM_ID) private readonly platformId: object,
    @Inject(DOCUMENT) private readonly document: Document
  ) {}

  /**
   * Apply the documented workspace defaults (foundation personality,
   * brand primary `#356c91`, light mode) with no tenant overrides.
   * Useful as a pre-HTTP synchronous-ish baseline.
   */
  async applyDefaults(): Promise<void> {
    return this.apply(undefined);
  }

  async apply(theme: ThemeConfig | undefined | null): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const mode =
      theme?.mode === 'light' || theme?.mode === 'dark'
        ? theme.mode
        : TenantThemeService.DEFAULT_MODE;
    const personalityId =
      theme?.personalityId || TenantThemeService.DEFAULT_PERSONALITY;
    const primaryColor =
      theme?.primaryColor || TenantThemeService.DEFAULT_PRIMARY_COLOR;

    this.themeService.setTheme(mode);

    // Await so the personality's generated palette lands BEFORE the
    // explicit overrides below; otherwise the awaited microtask would
    // overwrite them after the fact (see class-level comment).
    await this.themeService.setPersonality(personalityId);

    this.themeService.setPrimaryColor(primaryColor);

    if (!theme) return;

    const root = this.document.documentElement;
    if (theme.secondaryColor) {
      root.style.setProperty('--secondary', theme.secondaryColor);
    }
    if (theme.backgroundColor) {
      root.style.setProperty('--background', theme.backgroundColor);
    }
    if (theme.textColor) {
      root.style.setProperty('--foreground', theme.textColor);
    }
    if (theme.fontFamily) {
      root.style.setProperty('--font-body', theme.fontFamily);
    }

    if (theme.customCss !== undefined) {
      this.applyCustomCss(theme.customCss);
    }
  }

  /**
   * Inject (or update) tenant-supplied CSS after running it through
   * `sanitizeCustomCss`. Rejected payloads do not write to the DOM and
   * are logged to the console so operators can see what was blocked.
   *
   * SECURITY: this is denylist sanitization, not full isolation. Treat
   * `customCss` as low-trust input even after sanitization — when a
   * future iteration can spare the bundle weight, replace this with
   * either a CSS-AST allowlist (csstree/postcss in the renderer) or
   * scope the styles through a Shadow DOM / sandboxed iframe boundary.
   */
  private applyCustomCss(css: string): void {
    const sanitized = TenantThemeService.sanitizeCustomCss(css);
    if (sanitized === null) {
      return;
    }

    let styleElement = this.document.getElementById(
      CUSTOM_CSS_STYLE_ID
    ) as HTMLStyleElement | null;
    if (!styleElement) {
      styleElement = this.document.createElement('style');
      styleElement.id = CUSTOM_CSS_STYLE_ID;
      this.document.head.appendChild(styleElement);
    }
    styleElement.textContent = sanitized;
  }

  /**
   * Returns the sanitized CSS string if the input is acceptable, or
   * `null` if it must be rejected. Exported as `static` so the resolver
   * (or tests) can validate ahead of injection.
   */
  static sanitizeCustomCss(css: string): string | null {
    if (typeof css !== 'string') {
      return null;
    }
    if (css.length > CUSTOM_CSS_MAX_LENGTH) {
      console.warn(
        `[TenantThemeService] customCss rejected: length ${css.length} exceeds ${CUSTOM_CSS_MAX_LENGTH}`
      );
      return null;
    }
    for (const { pattern, reason } of FORBIDDEN_CUSTOM_CSS_PATTERNS) {
      if (pattern.test(css)) {
        console.warn(`[TenantThemeService] customCss rejected: ${reason}`);
        return null;
      }
    }
    return css;
  }
}
