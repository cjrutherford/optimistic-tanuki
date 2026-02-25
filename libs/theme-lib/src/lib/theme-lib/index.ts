// Re-export from theme-models (pure TypeScript, no Angular dependencies)
export {
  // Interfaces
  type DesignTokens,
  type ColorHarmonyType,
  type TypographyStyle,
  type SpacingScale,
  type BorderRadiusStyle,
  type ShadowIntensity,
  type AnimationSpeed,
  type IconStyle,
  type BorderStyle,
  type FontConfig,
  type PersonalityFonts,
  type AnimationConfig,
  type MobileAdaptations,
  type ModeConfig,
  type ColorHarmonyConfig,
  type ContrastConfig,
  type PersonalityTokenOverrides,
  type Personality,
  type PersonalityThemeConfig,
  type PersonalityCustomizations,
  type PersonalityColors,
  type GeneratedTheme,
  type ContrastReport,
  type ThemeContrastValidation,
  type PersonalitiesApiResponse,
  type ColorPalette,
  type ThemeGradients,
  type ThemeColors,
  type PaletteAnalysis,
  type PaletteMigrationResult,
  // Color utilities
  hexToRgb,
  generateColorShades,
  generateComplementaryColor,
  generateTertiaryColor,
  generateSuccessColor,
  generateDangerColor,
  generateWarningColor,
  // Color harmony
  generateComplementaryHarmony,
  generateTriadicHarmony,
  generateAnalogousHarmony,
  generateSplitComplementaryHarmony,
  generateTetradicHarmony,
  generateHarmonyHues,
  adjustSaturation,
  adjustLightness,
  generateHarmonyColor,
  generatePerceptualShades,
  generateSemanticColors,
  calculateColorTemperature,
  generatePersonalityColors,
  getHarmonyDescription,
  // Contrast utilities
  getRelativeLuminance,
  getContrastRatio,
  getContrastLevel,
  meetsContrastRequirement,
  ensureContrast,
  generateContrastReport,
  validateThemeContrast,
  getSuggestedTextColor,
  isDarkColor,
  calculateAPCA,
  getContrastSuggestion,
  // Palette migration
  analyzePalette,
  findBestMatchingPersonality,
  migratePaletteToPersonality,
  batchMigratePalettes,
  generateMigrationReport,
  shouldMigrateToPersonality,
  createPersonalityFromPalette,
} from '@optimistic-tanuki/theme-models';

// Angular-specific exports (keep in theme-lib)
export * from './theme-storage';
export * from './theme.interface';
export * from './theme.service';
export * from './themeable.interface';
export * from './theme-variable.service';
export * from './theme-host-bindings.directive';
export * from './theme-palettes';
export * from './design-tokens';
export * from './theme-config';
export * from './font-loading.service';
export * from './gradient-factory';
export * from './color-harmony';
export * from './contrast-utils';
export * from './palette-migration';
export * from './personality-gradients';
export {
  PREDEFINED_PERSONALITIES,
  getPersonalityById,
  getDefaultPersonality,
  getPersonalityIds,
  getPersonalitiesByCategory,
  isValidPersonalityId,
  getPersonalityPreviewColors,
} from './personalities';
