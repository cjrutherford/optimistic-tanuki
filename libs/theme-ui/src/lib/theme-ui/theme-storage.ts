import { isPlatformBrowser } from '@angular/common';

export function loadTheme(platformId: object): { theme: 'light' | 'dark'; accentColor: string, complementColor: string } {
  if (isPlatformBrowser(platformId)) {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    const savedAccentColor = localStorage.getItem('accentColor') || '#3f51b5';
    const savedComplementColor = localStorage.getItem('complementColor') || '#f0f0f0';
    return { theme: savedTheme, accentColor: savedAccentColor, complementColor: savedComplementColor};
  }
  return { theme: 'light', accentColor: '#3f51b5', complementColor: '#f0f0f0' }; // Default values for server-side
}

export function saveTheme(platformId: object, theme: 'light' | 'dark', accentColor: string, complement: string): void {
  if (isPlatformBrowser(platformId)) {
    localStorage.setItem('theme', theme);
    localStorage.setItem('accentColor', accentColor);
    localStorage.setItem('complementColor', complement);
  }
}
