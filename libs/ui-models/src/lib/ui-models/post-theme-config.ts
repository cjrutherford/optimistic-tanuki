/**
 * Theme configuration for individual posts (blog or social).
 * This allows each post to have its own visual styling independent
 * of the application's global theme.
 */
export interface PostThemeConfig {
  /**
   * Theme mode for the post
   */
  theme: 'light' | 'dark';
  
  /**
   * Accent color for the post (hex color code)
   */
  accentColor: string;
}

/**
 * Default post theme configuration
 */
export const DEFAULT_POST_THEME: PostThemeConfig = {
  theme: 'light',
  accentColor: '#3f51b5',
};
