/**
 * Font loading service for personality-based typography
 * Dynamically loads Google Fonts and custom fonts based on personality configuration
 */

import { Injectable, isDevMode } from '@angular/core';
import {
  Personality,
  PersonalityFonts,
  FontConfig,
  PREDEFINED_PERSONALITIES,
} from '@optimistic-tanuki/theme-models';

/**
 * Font loading status
 */
export interface FontLoadStatus {
  family: string;
  loaded: boolean;
  error?: string;
}

/**
 * Extract the primary family token from a CSS font stack, e.g.
 * `'Poppins, system-ui, sans-serif'` -> `poppins`. Detection must key off the
 * primary token, never a substring of the whole stack — otherwise any stack
 * containing a generic fallback (`sans-serif`, `system-ui`) is misclassified as
 * a system font and its web font never loads.
 */
function primaryFamilyToken(family: string): string {
  return family.split(',')[0].trim().replace(/['"]/g, '').toLowerCase();
}

/**
 * Generic/system/locally-installed family primaries that must never be network
 * loaded. Matched against the primary token only.
 */
const SYSTEM_FONT_PRIMARIES = new Set<string>([
  'system-ui',
  '-apple-system',
  'blinkmacsystemfont',
  'segoe ui',
  'sf mono',
  'sf pro',
  'monaco',
  'inconsolata',
  'menlo',
  'consolas',
  'arial',
  'arial narrow',
  'helvetica',
  'helvetica neue',
  'impact',
  'georgia',
  'times new roman',
  'courier new',
  'comic sans ms',
  'sans-serif',
  'serif',
  'monospace',
  'cursive',
  'fantasy',
]);

/**
 * Web font allowlist generated from the personality registry: every primary
 * `fonts.*.family` token that is not a system/local family is treated as
 * loadable. Generating this from the source of truth means a personality can
 * introduce a new web font without also editing a hand-maintained list.
 */
function buildRegistryWebFonts(): Set<string> {
  const fonts = new Set<string>();
  for (const personality of PREDEFINED_PERSONALITIES) {
    const configs = [
      personality.fonts.heading,
      personality.fonts.body,
      personality.fonts.mono,
      personality.fonts.accent,
    ];
    for (const config of configs) {
      if (!config) continue;
      const token = primaryFamilyToken(config.family);
      if (!SYSTEM_FONT_PRIMARIES.has(token)) {
        fonts.add(token);
      }
    }
  }
  return fonts;
}

const REGISTRY_WEB_FONTS = buildRegistryWebFonts();

/**
 * Service for loading fonts dynamically based on personality
 */
@Injectable({
  providedIn: 'root',
})
export class FontLoadingService {
  private loadedFonts = new Set<string>();
  private fontPromises = new Map<string, Promise<void>>();

  /**
   * Load all fonts for a personality
   */
  async loadPersonalityFonts(
    personality: Personality
  ): Promise<FontLoadStatus[]> {
    const fonts = personality.fonts;
    const results: FontLoadStatus[] = [];

    // Load each font type
    if (fonts.heading) {
      results.push(await this.loadFont('heading', fonts.heading));
    }

    results.push(await this.loadFont('body', fonts.body));

    if (fonts.mono) {
      results.push(await this.loadFont('mono', fonts.mono));
    }

    if (fonts.accent) {
      results.push(await this.loadFont('accent', fonts.accent));
    }

    if (isDevMode()) {
      const fallbacks = results.filter((r) => !r.loaded);
      if (fallbacks.length > 0) {
        console.warn(
          `[FontLoadingService] Personality "${personality.id}" has fonts that ` +
            `failed to load and will fall back: ` +
            fallbacks
              .map((f) => `${f.family}${f.error ? ` (${f.error})` : ''}`)
              .join(', ')
        );
      }
    }

    return results;
  }

  /**
   * Load a single font
   */
  private async loadFont(
    type: string,
    config: FontConfig
  ): Promise<FontLoadStatus> {
    const fontKey = `${config.family}:${config.weights.join(',')}`;

    // Already loaded
    if (this.loadedFonts.has(fontKey)) {
      return { family: config.family, loaded: true };
    }

    // Check if loading is in progress
    if (this.fontPromises.has(fontKey)) {
      try {
        await this.fontPromises.get(fontKey);
        return { family: config.family, loaded: true };
      } catch (error) {
        return {
          family: config.family,
          loaded: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    // Start loading
    const loadPromise = this.loadFontInternal(config);
    this.fontPromises.set(fontKey, loadPromise);

    try {
      await loadPromise;
      this.loadedFonts.add(fontKey);
      return { family: config.family, loaded: true };
    } catch (error) {
      return {
        family: config.family,
        loaded: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Internal font loading implementation
   */
  private async loadFontInternal(config: FontConfig): Promise<void> {
    // Check if this is a system/locally-installed font (no need to load)
    if (this.isSystemFont(config.family)) {
      return Promise.resolve();
    }

    // Check for a registry-recognized web font
    if (this.isGoogleFont(config.family)) {
      return this.loadGoogleFont(config);
    }

    // Unrecognized non-system family: nothing loads it, so it will silently
    // fall back to a generic and the personality collapses toward the default.
    // Surface it in development rather than failing quietly.
    if (isDevMode()) {
      console.warn(
        `[FontLoadingService] Font "${config.family}" is neither a known ` +
          `system font nor present in the personality registry; it will not ` +
          `be loaded and will fall back to a generic family.`
      );
    }
    return Promise.resolve();
  }

  /**
   * Check if a font's primary family is a system/locally-installed family that
   * should not be network loaded. Keyed off the primary token only.
   */
  private isSystemFont(family: string): boolean {
    return SYSTEM_FONT_PRIMARIES.has(primaryFamilyToken(family));
  }

  /**
   * Check if a font's primary family is a loadable web font. The allowlist is
   * generated from the personality registry (see REGISTRY_WEB_FONTS) so it
   * stays in sync with the fonts personalities actually declare.
   */
  private isGoogleFont(family: string): boolean {
    return REGISTRY_WEB_FONTS.has(primaryFamilyToken(family));
  }

  /**
   * Load a Google Font
   */
  private async loadGoogleFont(config: FontConfig): Promise<void> {
    const familyName = config.family.split(',')[0].trim().replace(/['"]/g, '');
    const weights = config.weights.join(',');
    const display = config.display || 'swap';

    // Create link element
    const linkId = `font-${this.sanitizeFontName(familyName)}`;

    // Check if already added to DOM
    if (document.getElementById(linkId)) {
      return Promise.resolve();
    }

    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      familyName
    )}:wght@${weights}&display=${display}`;

    // Add preload hint if specified
    if (config.preload) {
      const preloadLink = document.createElement('link');
      preloadLink.rel = 'preload';
      preloadLink.as = 'style';
      preloadLink.href = link.href;
      document.head.appendChild(preloadLink);
    }

    // Load the font
    return new Promise((resolve, reject) => {
      link.onload = () => resolve();
      link.onerror = () =>
        reject(new Error(`Failed to load font: ${familyName}`));

      document.head.appendChild(link);
    });
  }

  /**
   * Apply font CSS variables for a personality
   */
  applyFontVariables(personality: Personality): void {
    const fonts = personality.fonts;
    const root = document.documentElement;

    // Apply font families
    if (fonts.heading) {
      root.style.setProperty('--font-heading', fonts.heading.family);
    }
    root.style.setProperty('--font-body', fonts.body.family);
    if (fonts.mono) {
      root.style.setProperty('--font-mono', fonts.mono.family);
    }
    if (fonts.accent) {
      root.style.setProperty('--font-accent', fonts.accent.family);
    }

    // Apply default font to body
    root.style.setProperty('--font-family-base', fonts.body.family);
  }

  /**
   * Remove font CSS variables
   */
  removeFontVariables(): void {
    const root = document.documentElement;
    root.style.removeProperty('--font-heading');
    root.style.removeProperty('--font-body');
    root.style.removeProperty('--font-mono');
    root.style.removeProperty('--font-accent');
    root.style.removeProperty('--font-family-base');
  }

  /**
   * Preload fonts for better performance
   */
  preloadFonts(fonts: PersonalityFonts): void {
    const fontConfigs: FontConfig[] = [
      fonts.heading,
      fonts.body,
      fonts.mono,
      fonts.accent,
    ].filter((f): f is FontConfig => !!f);

    fontConfigs.forEach((config) => {
      if (config.preload && this.isGoogleFont(config.family)) {
        const familyName = config.family
          .split(',')[0]
          .trim()
          .replace(/['"]/g, '');
        const weights = config.weights.join(',');
        const display = config.display || 'swap';

        const linkId = `font-preload-${this.sanitizeFontName(familyName)}`;
        if (!document.getElementById(linkId)) {
          const link = document.createElement('link');
          link.id = linkId;
          link.rel = 'preload';
          link.as = 'style';
          link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
            familyName
          )}:wght@${weights}&display=${display}`;
          document.head.appendChild(link);
        }
      }
    });
  }

  /**
   * Sanitize font name for use in ID
   */
  private sanitizeFontName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  /**
   * Check if all fonts for a personality are loaded
   */
  async areFontsLoaded(personality: Personality): Promise<boolean> {
    const fonts = personality.fonts;
    const fontConfigs: FontConfig[] = [
      fonts.heading,
      fonts.body,
      fonts.mono,
      fonts.accent,
    ].filter((f): f is FontConfig => !!f);

    for (const config of fontConfigs) {
      const fontKey = `${config.family}:${config.weights.join(',')}`;
      if (!this.loadedFonts.has(fontKey)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get loaded font families
   */
  getLoadedFonts(): string[] {
    return Array.from(this.loadedFonts).map((key) => key.split(':')[0]);
  }

  /**
   * Reset loaded fonts (useful for testing)
   */
  reset(): void {
    this.loadedFonts.clear();
    this.fontPromises.clear();
  }
}
