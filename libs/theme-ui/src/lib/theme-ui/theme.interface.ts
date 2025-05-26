export interface ThemeGradients {
  [key: string]: string;
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
