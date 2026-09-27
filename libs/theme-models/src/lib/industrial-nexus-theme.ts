/**
 * IndustrialNexus theme configuration tailored for commercial builders and
 * contractors. Industrial slate surfaces with construction-amber accents,
 * high-contrast type for daylight trailer readability.
 */
export interface IndustrialNexusTheme {
  id: string;
  name: string;
  baseColor: string;
  primaryColor: string;
  accentColor: string;
  mode: 'dark' | 'light' | 'auto';
  highContrast: boolean;
  outdoorOptimized: boolean;
  cssVariables: Record<string, string>;
}

export const industrialNexusTheme: IndustrialNexusTheme = {
  id: 'industrial-nexus',
  name: 'Industrial Nexus',
  baseColor: '#1e293b',
  primaryColor: '#d97706',
  accentColor: '#fbbf24',
  mode: 'dark',
  highContrast: true,
  outdoorOptimized: true,
  cssVariables: {
    '--background': '#1e293b',
    '--background-secondary': '#0f172a',
    '--background-card': '#273449',
    '--surface': '#273449',
    '--surface-raised': '#334155',
    '--foreground': '#f8fafc',
    '--foreground-secondary': '#e2e8f0',
    '--foreground-muted': '#94a3b8',
    '--primary': '#d97706',
    '--primary-hover': '#b45309',
    '--primary-foreground': '#0f172a',
    '--accent': '#fbbf24',
    '--accent-hover': '#f59e0b',
    '--accent-foreground': '#1e293b',
    '--success': '#22c55e',
    '--success-foreground': '#0f172a',
    '--danger': '#ef4444',
    '--danger-foreground': '#f8fafc',
    '--warning': '#fbbf24',
    '--warning-foreground': '#1e293b',
    '--border': '#475569',
    '--border-color': '#475569',
    '--border-strong': '#64748b',
    '--input-bg': '#0f172a',
    '--overlay': 'rgba(2, 6, 23, 0.88)',
    '--shadow-crisp': '0 10px 25px -5px rgba(2, 6, 23, 0.65)',
    '--focus-ring': '0 0 0 2px rgba(251, 191, 36, 0.4)',
  },
};
