import { DesignTokens } from './theme.interface';

export const DEFAULT_DESIGN_TOKENS: DesignTokens = {
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },

  shadows: {
    none: 'none',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },

  borderRadius: {
    none: '0',
    sm: '2px',
    md: '4px',
    lg: '8px',
    xl: '12px',
    full: '50%',
  },

  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    xxl: '1.5rem',
  },

  zIndex: {
    base: 0,
    dropdown: 1000,
    modal: 1050,
    tooltip: 1070,
    overlay: 1080,
  },
};

// Generate CSS custom properties from design tokens
export function generateDesignTokenCSSVariables(tokens: DesignTokens): Record<string, string> {
  const variables: Record<string, string> = {};

  // Spacing
  Object.entries(tokens.spacing).forEach(([key, value]) => {
    variables[`--spacing-${key}`] = value;
  });

  // Shadows
  Object.entries(tokens.shadows).forEach(([key, value]) => {
    variables[`--shadow-${key}`] = value;
  });

  // Border radius
  Object.entries(tokens.borderRadius).forEach(([key, value]) => {
    variables[`--border-radius-${key}`] = value;
  });

  // Font size
  Object.entries(tokens.fontSize).forEach(([key, value]) => {
    variables[`--font-size-${key}`] = value;
  });

  // Z-index
  Object.entries(tokens.zIndex).forEach(([key, value]) => {
    variables[`--z-index-${key}`] = value.toString();
  });

  return variables;
}