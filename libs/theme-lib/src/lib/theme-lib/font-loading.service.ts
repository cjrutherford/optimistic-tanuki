/**
 * Font loading service for personality-based typography
 * Dynamically loads Google Fonts and custom fonts based on personality configuration
 */

import { Injectable } from '@angular/core';
import {
  Personality,
  PersonalityFonts,
  FontConfig,
} from './personality.interface';

/**
 * Font loading status
 */
export interface FontLoadStatus {
  family: string;
  loaded: boolean;
  error?: string;
}

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
    // Check if this is a system font (no need to load)
    if (this.isSystemFont(config.family)) {
      return Promise.resolve();
    }

    // Check for Google Fonts
    if (this.isGoogleFont(config.family)) {
      return this.loadGoogleFont(config);
    }

    // For custom fonts, assume they're already loaded or use @font-face in CSS
    return Promise.resolve();
  }

  /**
   * Check if font is a system font
   */
  private isSystemFont(family: string): boolean {
    const systemFonts = [
      'system-ui',
      '-apple-system',
      'blinkmacsystemfont',
      'segoe ui',
      'roboto',
      'helvetica neue',
      'arial',
      'sans-serif',
      'serif',
      'monospace',
      'georgia',
      'times new roman',
      'courier new',
      'cursive',
      'fantasy',
    ];

    const normalizedFamily = family.toLowerCase();
    return systemFonts.some((sf) => normalizedFamily.includes(sf));
  }

  /**
   * Check if font is a Google Font
   */
  private isGoogleFont(family: string): boolean {
    const googleFonts = [
      'inter',
      'poppins',
      'nunito sans',
      'quicksand',
      'source sans pro',
      'source code pro',
      'cormorant garamond',
      'playfair display',
      'great vibes',
      'comic neue',
      'fredoka',
      'jetbrains mono',
      'fira code',
      'sf mono',
    ];

    const normalizedFamily = family.toLowerCase().split(',')[0].trim();
    return googleFonts.some((gf) => normalizedFamily.includes(gf));
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
