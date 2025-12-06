export * from './lib/common-ui';
// Re-export theme interfaces from theme-lib for backward compatibility
export type { ThemeColors, ThemeGradients } from '@optimistic-tanuki/theme-lib';
export * from './lib/common-ui/gradient-builder';

// Export SCSS mixins path for import usage
export const MIXINS_SCSS_PATH = './lib/styles/mixins.scss';