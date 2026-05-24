/**
 * Theme configuration for the application
 */
export interface ThemeConfig {
  mode?: 'light' | 'dark';
  personalityId?: string;
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  customCss?: string;
}
