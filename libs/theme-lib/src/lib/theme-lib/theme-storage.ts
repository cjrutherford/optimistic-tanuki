import { isPlatformBrowser } from '@angular/common';

export interface SavedTheme {
  theme: 'light' | 'dark';
  accentColor: string;
  complementColor: string;
  paletteMode: 'custom' | 'predefined';
  paletteName?: string;
}

export function loadTheme(platformId: object): SavedTheme {
  if (isPlatformBrowser(platformId)) {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    const savedAccentColor = localStorage.getItem('accentColor') || '#3f51b5';
    const savedComplementColor = localStorage.getItem('complementColor') || '#c0af4b';
    const savedPaletteMode = localStorage.getItem('paletteMode') as 'custom' | 'predefined' || 'custom';
    const savedPaletteName = localStorage.getItem('paletteName') || undefined;
    
    return { 
      theme: savedTheme, 
      accentColor: savedAccentColor, 
      complementColor: savedComplementColor,
      paletteMode: savedPaletteMode,
      paletteName: savedPaletteName
    };
  }
  return { 
    theme: 'light', 
    accentColor: '#3f51b5', 
    complementColor: '#c0af4b',
    paletteMode: 'custom'
  }; // Default values for server-side
}

export function saveTheme(platformId: object, savedTheme: SavedTheme): void {
  if (isPlatformBrowser(platformId)) {
    localStorage.setItem('theme', savedTheme.theme);
    localStorage.setItem('accentColor', savedTheme.accentColor);
    localStorage.setItem('complementColor', savedTheme.complementColor);
    localStorage.setItem('paletteMode', savedTheme.paletteMode);
    if (savedTheme.paletteName) {
      localStorage.setItem('paletteName', savedTheme.paletteName);
    } else {
      localStorage.removeItem('paletteName');
    }
  }
}
