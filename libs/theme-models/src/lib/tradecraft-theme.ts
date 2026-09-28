/**
 * TradeCraft theme configuration tailored for trade and field service operators.
 * High-contrast, daylight-readable theme with 48px minimum touch targets.
 */
export interface TradeCraftTheme {
  id: string;
  name: string;
  baseColor: string;
  primaryColor: string;
  accentColor: string;
  minTouchTargetPx: number;
  mode: 'dark' | 'light' | 'auto';
  highContrast: boolean;
  outdoorOptimized: boolean;
  cssVariables: Record<string, string>;
}

export const tradeCraftTheme: TradeCraftTheme = {
  id: 'tradecraft',
  name: 'TradeCraft',
  baseColor: '#0f172a',
  primaryColor: '#f59e0b',
  accentColor: '#06b6d4',
  minTouchTargetPx: 48,
  mode: 'dark',
  highContrast: true,
  outdoorOptimized: true,
  cssVariables: {
    '--background': '#0f172a',
    '--background-secondary': '#1e293b',
    '--background-card': '#1e293b',
    '--foreground': '#f8fafc',
    '--foreground-muted': '#94a3b8',
    '--primary': '#f59e0b',
    '--primary-hover': '#d97706',
    '--primary-foreground': '#0f172a',
    '--accent': '#06b6d4',
    '--accent-hover': '#0891b2',
    '--accent-foreground': '#0f172a',
    '--border-color': '#334155',
    '--input-bg': '#0f172a',
    '--touch-target-min': '48px',
    '--font-contrast-ratio': '7.5',
  },
};
