/**
 * CivicClear theme configuration tailored for municipal and public sector
 * portals. Clean, high-contrast, and readable, satisfying WCAG 2.1 AA and
 * Section 508 contrast and focus requirements.
 */
export interface CivicClearTheme {
  id: string;
  name: string;
  baseColor: string;
  primaryColor: string;
  accentColor: string;
  mode: 'dark' | 'light' | 'auto';
  highContrast: boolean;
  cssVariables: Record<string, string>;
}

export const civicClearTheme: CivicClearTheme = {
  id: 'civic-clear',
  name: 'Civic Clear',
  baseColor: '#ffffff',
  primaryColor: '#1d4ed8',
  accentColor: '#b45309',
  mode: 'light',
  highContrast: true,
  cssVariables: {
    '--background': '#ffffff',
    '--background-secondary': '#f1f5f9',
    '--background-card': '#ffffff',
    '--surface': '#f8fafc',
    '--surface-raised': '#ffffff',
    '--foreground': '#0f172a',
    '--foreground-secondary': '#334155',
    '--foreground-muted': '#475569',
    '--primary': '#1d4ed8',
    '--primary-hover': '#1e40af',
    '--primary-foreground': '#ffffff',
    '--accent': '#b45309',
    '--accent-hover': '#92400e',
    '--accent-foreground': '#ffffff',
    '--success': '#15803d',
    '--success-foreground': '#ffffff',
    '--danger': '#b91c1c',
    '--danger-foreground': '#ffffff',
    '--warning': '#b45309',
    '--warning-foreground': '#ffffff',
    '--border': '#94a3b8',
    '--border-color': '#94a3b8',
    '--border-strong': '#475569',
    '--input-bg': '#ffffff',
    '--overlay': 'rgba(15, 23, 42, 0.6)',
    '--focus-ring': '0 0 0 3px rgba(29, 78, 216, 0.45)',
  },
};
