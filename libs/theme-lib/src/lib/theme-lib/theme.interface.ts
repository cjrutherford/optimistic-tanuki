export interface ThemeGradients {
  [key: string]: string;
}

export interface DesignTokens {
  // Spacing scale
  spacing: {
    xs: string;    // 4px
    sm: string;    // 8px
    md: string;    // 16px
    lg: string;    // 24px
    xl: string;    // 32px
    xxl: string;   // 48px
  };

  // Shadow scale
  shadows: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };

  // Border radius scale
  borderRadius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
  };

  // Typography scale
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    xxl: string;
  };

  // Z-index scale
  zIndex: {
    base: number;
    dropdown: number;
    modal: number;
    tooltip: number;
    overlay: number;
  };
}

export interface ColorPalette {
  name: string;
  description: string;
  accent: string;
  complementary: string;
  tertiary?: string;
  background?: {
    light: string;
    dark: string;
  };
  foreground?: {
    light: string;
    dark: string;
  };
}

export interface ThemeColors {
  background: string;
  foreground: string;
  accent: string;
  accentShades: [string, string][];
  accentGradients: ThemeGradients;
  complementary: string;
  complementaryShades: [string, string][];
  complementaryGradients: ThemeGradients;
  tertiary: string;
  tertiaryShades: [string, string][];
  tertiaryGradients: ThemeGradients;
  success: string;
  successShades: [string, string][];
  successGradients: ThemeGradients;
  danger: string;
  dangerShades: [string, string][];
  dangerGradients: ThemeGradients;
  warning: string;
  warningShades: [string, string][];
  warningGradients: ThemeGradients;
}
