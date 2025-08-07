import { isPlatformBrowser } from '@angular/common';

/**
 * Loads the saved theme and accent color from local storage.
 * @param platformId The platform ID to check if running in a browser environment.
 * @returns An object containing the loaded theme and accent color.
 */
export function loadTheme(platformId: object): { theme: 'light' | 'dark'; accentColor: string } {
  if (isPlatformBrowser(platformId)) {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    const savedAccentColor = localStorage.getItem('accentColor') || '#3f51b5';
    return { theme: savedTheme, accentColor: savedAccentColor };
  }
  return { theme: 'light', accentColor: '#3f51b5' }; // Default values for server-side
}

/**
 * Saves the current theme and accent color to local storage.
 * @param platformId The platform ID to check if running in a browser environment.
 * @param theme The theme to save ('light' or 'dark').
 * @param accentColor The accent color to save.
 */
export function saveTheme(platformId: object, theme: 'light' | 'dark', accentColor: string): void {
  if (isPlatformBrowser(platformId)) {
    localStorage.setItem('theme', theme);
    localStorage.setItem('accentColor', accentColor);
  }
}
