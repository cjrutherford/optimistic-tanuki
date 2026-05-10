export * from './lib/theme-ui/theme.component';
export {
  ThemeCycleTiming,
  ThemeMotionProfile,
  ThemeMotionStyle,
  THEME_LAYER_CLASS_ORDER,
  ensureThemeLayerOrdering,
} from '@optimistic-tanuki/theme-lib';
export * from './lib/theme-ui/palette-selector.component';
export * from './lib/theme-ui/palette-manager.component';
export {
  ThemeHostBindingsDirective,
  applyThemeToHostBindings,
} from '@optimistic-tanuki/theme-lib';
export { ThemeVariableService } from '@optimistic-tanuki/theme-lib';
export { ThemeValidationHarnessComponent } from '@optimistic-tanuki/theme-lib';
export * from './lib/theme-ui/theme-demo.component';
export * from './lib/theme-ui/theme-designer.component';
export * from './lib/theme-ui/personality-selector.component';
export * from './lib/theme-ui/personality-preview.component';

// Re-export utilities SCSS for import usage
export const UTILITIES_SCSS_PATH = './lib/theme-ui/utilities.scss';
