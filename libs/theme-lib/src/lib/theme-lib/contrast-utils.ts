/**
 * WCAG 2.1 contrast ratio utilities
 * Ensures text and interactive elements meet accessibility standards
 */

import {
  ContrastReport,
  ThemeContrastValidation,
} from './personality.interface';

/**
 * Calculate relative luminance of a color per WCAG 2.1
 * Formula: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function getRelativeLuminance(hexColor: string): number {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return 0;

  // Convert to sRGB
  const rsRGB = rgb.r / 255;
  const gsRGB = rgb.g / 255;
  const bsRGB = rgb.b / 255;

  // Apply gamma correction
  const r =
    rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const g =
    gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const b =
    bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Convert hex to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Calculate contrast ratio between two colors
 * WCAG formula: (L1 + 0.05) / (L2 + 0.05)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getRelativeLuminance(color1);
  const lum2 = getRelativeLuminance(color2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Determine WCAG compliance level based on contrast ratio
 */
export function getContrastLevel(ratio: number): 'AAA' | 'AA' | 'FAIL' {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  return 'FAIL';
}

/**
 * Check if contrast ratio meets minimum requirement
 */
export function meetsContrastRequirement(
  ratio: number,
  minRatio: 4.5 | 7 = 4.5
): boolean {
  return ratio >= minRatio;
}

/**
 * Auto-adjust a color to meet minimum contrast ratio
 * @param foreground - The foreground color to adjust
 * @param background - The background color
 * @param minRatio - Minimum required contrast ratio
 * @param direction - Direction to adjust: 'lighten', 'darken', or 'auto'
 * @returns Adjusted color that meets contrast requirement
 */
export function ensureContrast(
  foreground: string,
  background: string,
  minRatio: 4.5 | 7 = 4.5,
  direction: 'lighten' | 'darken' | 'auto' = 'auto'
): string {
  let adjustedColor = foreground;
  let iterations = 0;
  const maxIterations = 20;

  // Determine adjustment direction if auto
  let adjustDirection = direction;
  if (adjustDirection === 'auto') {
    const bgLum = getRelativeLuminance(background);
    adjustDirection = bgLum > 0.5 ? 'darken' : 'lighten';
  }

  while (iterations < maxIterations) {
    const ratio = getContrastRatio(adjustedColor, background);

    if (ratio >= minRatio) {
      return adjustedColor;
    }

    // Adjust the color
    adjustedColor = adjustColorBrightness(
      adjustedColor,
      adjustDirection === 'lighten' ? 0.05 : -0.05
    );

    iterations++;
  }

  // If we couldn't achieve the ratio, return the closest we got
  console.warn(
    `Could not achieve ${minRatio}:1 contrast ratio between ${foreground} and ${background}`
  );
  return adjustedColor;
}

/**
 * Adjust color brightness by a factor
 */
function adjustColorBrightness(hexColor: string, factor: number): string {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return hexColor;

  const r = Math.max(0, Math.min(255, Math.round(rgb.r + factor * 255)));
  const g = Math.max(0, Math.min(255, Math.round(rgb.g + factor * 255)));
  const b = Math.max(0, Math.min(255, Math.round(rgb.b + factor * 255)));

  return rgbToHex(r, g, b);
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * Generate a contrast report for a color combination
 */
export function generateContrastReport(
  foreground: string,
  background: string,
  minRatio: 4.5 | 7 = 4.5
): ContrastReport {
  const ratio = getContrastRatio(foreground, background);
  const level = getContrastLevel(ratio);

  return {
    isValid: ratio >= minRatio,
    ratio: Math.round(ratio * 100) / 100,
    level,
    foreground,
    background,
  };
}

/**
 * Validate contrast for a set of theme colors
 */
export function validateThemeContrast(
  colors: {
    foreground: string;
    background: string;
    primary: string;
    secondary: string;
    muted: string;
  },
  minRatio: 4.5 | 7 = 4.5
): ThemeContrastValidation {
  const reports: ContrastReport[] = [];
  const violations: ContrastReport[] = [];
  const autoFixes: Record<string, string> = {};

  // Primary text on background
  const primaryText = generateContrastReport(
    colors.foreground,
    colors.background,
    minRatio
  );
  reports.push(primaryText);
  if (!primaryText.isValid) {
    violations.push(primaryText);
    autoFixes['foreground'] = ensureContrast(
      colors.foreground,
      colors.background,
      minRatio
    );
  }

  // Secondary text on background
  const secondaryText = generateContrastReport(
    colors.muted,
    colors.background,
    minRatio
  );
  reports.push(secondaryText);
  if (!secondaryText.isValid) {
    violations.push(secondaryText);
    autoFixes['muted'] = ensureContrast(
      colors.muted,
      colors.background,
      minRatio
    );
  }

  // Primary color on background (for buttons, links)
  const primaryOnBg = generateContrastReport(
    colors.primary,
    colors.background,
    minRatio
  );
  reports.push(primaryOnBg);
  if (!primaryOnBg.isValid) {
    violations.push(primaryOnBg);
    autoFixes['primaryOnBackground'] = ensureContrast(
      colors.primary,
      colors.background,
      minRatio
    );
  }

  // White text on primary color (for primary buttons)
  const whiteOnPrimary = generateContrastReport(
    '#ffffff',
    colors.primary,
    minRatio
  );
  reports.push(whiteOnPrimary);
  if (!whiteOnPrimary.isValid) {
    violations.push(whiteOnPrimary);
    autoFixes['whiteOnPrimary'] = ensureContrast(
      '#ffffff',
      colors.primary,
      minRatio
    );
  }

  // Secondary color on background
  const secondaryOnBg = generateContrastReport(
    colors.secondary,
    colors.background,
    minRatio
  );
  reports.push(secondaryOnBg);
  if (!secondaryOnBg.isValid) {
    violations.push(secondaryOnBg);
    autoFixes['secondaryOnBackground'] = ensureContrast(
      colors.secondary,
      colors.background,
      minRatio
    );
  }

  return {
    isValid: violations.length === 0,
    reports,
    violations,
    autoFixes: Object.keys(autoFixes).length > 0 ? autoFixes : undefined,
  };
}

/**
 * Get suggested text color (black or white) for a background
 * Returns the color that provides better contrast
 */
export function getSuggestedTextColor(
  backgroundColor: string,
  minRatio: 4.5 | 7 = 4.5
): { color: string; ratio: number } {
  const whiteRatio = getContrastRatio('#ffffff', backgroundColor);
  const blackRatio = getContrastRatio('#000000', backgroundColor);

  if (whiteRatio >= minRatio && whiteRatio >= blackRatio) {
    return { color: '#ffffff', ratio: whiteRatio };
  }

  if (blackRatio >= minRatio) {
    return { color: '#000000', ratio: blackRatio };
  }

  // Neither meets requirement, return the better one
  return whiteRatio > blackRatio
    ? { color: '#ffffff', ratio: whiteRatio }
    : { color: '#000000', ratio: blackRatio };
}

/**
 * Check if a color is "dark" (closer to black)
 * Useful for determining whether to use light or dark text
 */
export function isDarkColor(hexColor: string): boolean {
  const luminance = getRelativeLuminance(hexColor);
  return luminance < 0.5;
}

/**
 * Calculate APCA (Accessible Perceptual Contrast Algorithm) value
 * APCA is the next-generation contrast algorithm (may replace WCAG in future)
 * Returns value from -108 to 106 (0 is no contrast)
 */
export function calculateAPCA(foreground: string, background: string): number {
  const lumFg = getRelativeLuminance(foreground);
  const lumBg = getRelativeLuminance(background);

  // APCA formula (simplified)
  const Ybg = lumBg;
  const Yfg = lumFg;

  const SAPC = 0;
  const output = 0;

  // This is a placeholder - full APCA is complex
  // For now, we'll use a simplified version
  if (Ybg > Yfg) {
    return (Math.pow(Ybg, 0.56) - Math.pow(Yfg, 0.57)) * 1.14;
  } else {
    return (Math.pow(Ybg, 0.62) - Math.pow(Yfg, 0.65)) * 1.14;
  }
}

/**
 * Get contrast suggestion for improvement
 */
export function getContrastSuggestion(
  currentRatio: number,
  targetRatio: 4.5 | 7 = 4.5
): string {
  const difference = targetRatio - currentRatio;

  if (difference <= 0) {
    return 'Contrast ratio meets requirements.';
  }

  if (difference < 1) {
    return 'Slight adjustment needed. Try darkening the text or lightening the background.';
  }

  if (difference < 3) {
    return 'Moderate adjustment needed. Consider using a darker text color or significantly lighter background.';
  }

  return 'Significant adjustment required. Current colors are not suitable for text. Consider using black text on light backgrounds or white text on dark backgrounds.';
}
