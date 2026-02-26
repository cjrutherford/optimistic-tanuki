/**
 * Palette to Personality migration utilities
 * Analyzes existing color palettes and suggests appropriate personalities
 */

import { ColorPalette } from './personality.interfaces';
import {
  Personality,
  PersonalityThemeConfig,
  PaletteAnalysis,
  PaletteMigrationResult,
  ColorHarmonyType,
} from './personality.interfaces';
import {
  PREDEFINED_PERSONALITIES,
  getDefaultPersonality,
} from './personalities';

/**
 * Convert hex color to RGB
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
 * Convert RGB to HSL
 */
function rgbToHsl(rgb: { r: number; g: number; b: number }): {
  h: number;
  s: number;
  l: number;
} {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Analyze a color palette to determine its characteristics
 */
export function analyzePalette(palette: ColorPalette): PaletteAnalysis {
  const accentRgb = hexToRgb(palette.accent);
  const compRgb = hexToRgb(palette.complementary);

  if (!accentRgb || !compRgb) {
    return {
      saturation: 50,
      contrast: 4.5,
      harmony: null,
      spacing: 'comfortable',
      warmth: 0,
      vibrancy: 50,
    };
  }

  const accentHsl = rgbToHsl(accentRgb);
  const compHsl = rgbToHsl(compRgb);

  // Calculate saturation
  const saturation = (accentHsl.s + compHsl.s) / 2;

  // Calculate contrast
  const contrast = calculateContrastRatio(accentHsl.l, compHsl.l);

  // Detect harmony type
  const harmony = detectHarmonyType(accentHsl.h, compHsl.h);

  // Determine spacing preference based on contrast and saturation
  const spacing = determineSpacing(saturation, contrast);

  // Calculate warmth (0 = cool, 1 = warm)
  const warmth = calculateWarmth(accentHsl.h);

  // Calculate vibrancy (combination of saturation and contrast)
  const vibrancy = (saturation + contrast * 10) / 2;

  return {
    saturation,
    contrast,
    harmony,
    spacing,
    warmth,
    vibrancy,
  };
}

/**
 * Calculate contrast ratio between two lightness values
 */
function calculateContrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2) / 100;
  const darker = Math.min(l1, l2) / 100;
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Detect harmony type from hue difference
 */
function detectHarmonyType(
  hue1: number,
  hue2: number
): ColorHarmonyType | null {
  const diff = Math.abs(hue1 - hue2);
  const normalizedDiff = Math.min(diff, 360 - diff);

  if (normalizedDiff >= 170 && normalizedDiff <= 190) {
    return 'complementary';
  } else if (normalizedDiff >= 115 && normalizedDiff <= 125) {
    return 'triadic';
  } else if (normalizedDiff >= 30 && normalizedDiff <= 40) {
    return 'analogous';
  } else if (
    (normalizedDiff >= 140 && normalizedDiff <= 160) ||
    (normalizedDiff >= 200 && normalizedDiff <= 220)
  ) {
    return 'split-complementary';
  } else if (normalizedDiff >= 85 && normalizedDiff <= 95) {
    return 'tetradic';
  }

  return null;
}

/**
 * Determine spacing preference from palette characteristics
 */
function determineSpacing(
  saturation: number,
  contrast: number
): 'compact' | 'comfortable' | 'spacious' {
  // High saturation + high contrast = bold/playful = spacious
  // Low saturation + low contrast = minimal = spacious
  // Medium values = comfortable
  // Very high contrast = professional = comfortable

  if (saturation > 70 && contrast > 7) {
    return 'spacious';
  } else if (saturation < 35 && contrast < 5) {
    return 'spacious';
  } else if (contrast > 8) {
    return 'comfortable';
  } else {
    return 'comfortable';
  }
}

/**
 * Calculate warmth from hue (0 = cool, 1 = warm)
 */
function calculateWarmth(hue: number): number {
  // Warm colors: red (0/360), orange (30), yellow (60)
  // Cool colors: green (120), blue (240), purple (270)

  const warmStart = 330; // magenta-red
  const warmEnd = 60; // yellow

  if (hue >= warmStart || hue <= warmEnd) {
    // In warm range
    return 1;
  } else if (hue >= 120 && hue <= 240) {
    // In cool range
    return 0;
  } else {
    // Transition zone
    return 0.5;
  }
}

/**
 * Find the best matching personality for a palette
 */
export function findBestMatchingPersonality(analysis: PaletteAnalysis): {
  personality: Personality;
  confidence: number;
  reason: string;
} {
  const scores: Array<{
    personality: Personality;
    score: number;
    reason: string;
  }> = [];

  for (const personality of PREDEFINED_PERSONALITIES) {
    let score = 0;
    const reasons: string[] = [];

    // Check harmony type match
    if (analysis.harmony === personality.colorHarmony.type) {
      score += 30;
      reasons.push('color harmony match');
    }

    // Check saturation alignment
    const targetSaturation = personality.colorHarmony.accentSaturation;
    const saturationDiff = Math.abs(analysis.saturation - targetSaturation);
    if (saturationDiff < 15) {
      score += 25;
      reasons.push('saturation alignment');
    } else if (saturationDiff < 30) {
      score += 15;
    }

    // Check contrast preference
    if (analysis.contrast >= 6 && personality.contrast.minimumRatio >= 7) {
      score += 20;
      reasons.push('high contrast preference');
    } else if (
      analysis.contrast < 5 &&
      personality.contrast.minimumRatio <= 4.5
    ) {
      score += 15;
      reasons.push('moderate contrast preference');
    }

    // Check spacing preference
    if (analysis.spacing === personality.tokens.spacingScale) {
      score += 15;
      reasons.push('spacing preference match');
    }

    // Warmth bonus for certain personalities
    if (analysis.warmth > 0.7 && personality.id === 'bold') {
      score += 10;
      reasons.push('warm color preference');
    } else if (analysis.warmth < 0.3 && personality.id === 'minimal') {
      score += 10;
      reasons.push('cool color preference');
    }

    // Vibrancy check
    if (analysis.vibrancy > 70 && personality.id === 'playful') {
      score += 15;
      reasons.push('high vibrancy match');
    } else if (analysis.vibrancy < 40 && personality.id === 'minimal') {
      score += 15;
      reasons.push('low vibrancy match');
    }

    scores.push({
      personality,
      score,
      reason: reasons.join(', ') || 'general compatibility',
    });
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  const best = scores[0];
  const confidence = Math.min(100, best.score);

  return {
    personality: best.personality,
    confidence,
    reason: best.reason,
  };
}

/**
 * Migrate a legacy palette to the personality system
 */
export function migratePaletteToPersonality(
  palette: ColorPalette,
  mode: 'light' | 'dark' = 'light'
): PaletteMigrationResult {
  // Analyze the palette
  const analysis = analyzePalette(palette);

  // Find best matching personality
  const { personality, confidence, reason } =
    findBestMatchingPersonality(analysis);

  // Create the config
  const config: PersonalityThemeConfig = {
    personalityId: personality.id,
    primaryColor: palette.accent,
    mode: mode,
    version: '1.0.0',
  };

  return {
    success: true,
    suggestedPersonalityId: personality.id,
    primaryColor: palette.accent,
    confidence,
    config,
    reason: `Based on ${reason}`,
  };
}

/**
 * Batch migrate multiple palettes
 */
export function batchMigratePalettes(
  palettes: ColorPalette[]
): PaletteMigrationResult[] {
  return palettes.map((palette) => migratePaletteToPersonality(palette));
}

/**
 * Generate migration report
 */
export function generateMigrationReport(results: PaletteMigrationResult[]): {
  total: number;
  successful: number;
  averageConfidence: number;
  personalityDistribution: Record<string, number>;
} {
  const total = results.length;
  const successful = results.filter((r) => r.success).length;
  const averageConfidence =
    results.reduce((sum, r) => sum + r.confidence, 0) / total;

  const personalityDistribution: Record<string, number> = {};
  results.forEach((result) => {
    const id = result.suggestedPersonalityId;
    personalityDistribution[id] = (personalityDistribution[id] || 0) + 1;
  });

  return {
    total,
    successful,
    averageConfidence,
    personalityDistribution,
  };
}

/**
 * Check if a palette should migrate to a specific personality
 */
export function shouldMigrateToPersonality(
  palette: ColorPalette,
  targetPersonalityId: string,
  minConfidence = 60
): boolean {
  const result = migratePaletteToPersonality(palette);
  return (
    result.suggestedPersonalityId === targetPersonalityId &&
    result.confidence >= minConfidence
  );
}

/**
 * Create a custom personality from a palette (for edge cases)
 * Note: This creates a Classic-based personality with palette colors
 */
export function createPersonalityFromPalette(
  palette: ColorPalette,
  name?: string
): Personality {
  const basePersonality = getDefaultPersonality();

  return {
    ...basePersonality,
    id: `custom-${Date.now()}`,
    name: name || `Custom: ${palette.name}`,
    description:
      palette.description || 'Custom personality based on legacy palette',
    isClassic: false,
    colorHarmony: {
      ...basePersonality.colorHarmony,
      // Use the actual colors as hints
      accentSaturation: 65,
      accentLightness: 50,
    },
  };
}
