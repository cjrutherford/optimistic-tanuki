/**
 * SovereignVault theme configuration tailored for regulated CPA, tax, and legal firms.
 * Deep executive navy, security-grade slate, and gold trust accent tokens.
 */
export interface SovereignVaultTheme {
  id: string;
  name: string;
  baseColor: string;
  primaryColor: string;
  accentColor: string;
  mode: 'dark' | 'light' | 'auto';
  highContrast: boolean;
  complianceFocused: boolean;
  cssVariables: Record<string, string>;
}

export const sovereignVaultTheme: SovereignVaultTheme = {
  id: 'sovereign-vault',
  name: 'Sovereign Vault',
  baseColor: '#0f172a',
  primaryColor: '#1d4ed8',
  accentColor: '#38bdf8',
  mode: 'dark',
  highContrast: true,
  complianceFocused: true,
  cssVariables: {
    '--background': '#0f172a',
    '--background-secondary': '#1e293b',
    '--background-card': '#1e293b',
    '--surface': '#1e293b',
    '--surface-raised': '#111c33',
    '--foreground': '#f8fafc',
    '--foreground-secondary': '#cbd5e1',
    '--foreground-muted': '#94a3b8',
    '--primary': '#1d4ed8',
    '--primary-hover': '#1e40af',
    '--primary-foreground': '#ffffff',
    '--accent': '#38bdf8',
    '--accent-hover': '#0ea5e9',
    '--accent-foreground': '#0f172a',
    '--success': '#22c55e',
    '--success-foreground': '#0f172a',
    '--danger': '#ef4444',
    '--danger-foreground': '#f8fafc',
    '--warning': '#eab308',
    '--warning-foreground': '#0f172a',
    '--gold-seal': '#e0a96d',
    '--border': '#334155',
    '--border-color': '#334155',
    '--border-strong': '#475569',
    '--input-bg': '#0f172a',
    '--overlay': 'rgba(2, 6, 23, 0.88)',
    '--shadow-crisp': '0 10px 25px -5px rgba(2, 6, 23, 0.65)',
    '--border-secure': '#22c55e',
    '--trust-badge-bg': 'rgba(34, 197, 94, 0.12)',
    '--trust-badge-color': '#86efac',
    '--focus-ring': '0 0 0 2px rgba(56, 189, 248, 0.35)',
  },
};
