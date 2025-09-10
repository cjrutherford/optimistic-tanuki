import { isPlatformBrowser } from '@angular/common';

export function loadTheme(platformId: object): { theme: 'light' | 'dark'; accentColor: string } {
  if (isPlatformBrowser(platformId)) {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    const savedAccentColor = localStorage.getItem('accentColor') || '#3f51b5';
    return { theme: savedTheme, accentColor: savedAccentColor };
  }
  return { theme: 'light', accentColor: '#3f51b5' }; // Default values for server-side
}

export function saveTheme(platformId: object, theme: 'light' | 'dark', accentColor: string): void {
  if (isPlatformBrowser(platformId)) {
    localStorage.setItem('theme', theme);
    localStorage.setItem('accentColor', accentColor);
  }
}
