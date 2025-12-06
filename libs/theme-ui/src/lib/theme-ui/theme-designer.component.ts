import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeService, ColorPalette } from '@optimistic-tanuki/theme-lib';
import { GradientBuilder, GradientType } from '@optimistic-tanuki/common-ui';
import { Subject, takeUntil } from 'rxjs';
import { PREDEFINED_PALETTES } from '@optimistic-tanuki/theme-lib';

interface GradientPreset {
  name: string;
  type: GradientType;
  colors: string[];
  angle?: string;
  direction?: string;
}

interface ShadowPreset {
  name: string;
  value: string;
}

@Component({
  selector: 'lib-theme-designer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './theme-designer.component.html',
  styleUrls: ['./theme-designer.component.scss'],
})
export class ThemeDesignerComponent implements OnInit, OnDestroy {
  // Color selection
  accentColor = '#3f51b5';
  complementaryColor = '#c0af4b';
  currentTheme: 'light' | 'dark' = 'light';
  
  // Palette management
  availablePalettes: ColorPalette[] = [];
  showPaletteForm = false;
  paletteFormMode: 'create' | 'edit' = 'create';
  paletteFormData: ColorPalette = this.getEmptyPalette();
  paletteFormError: string | null = null;
  originalPaletteName: string | null = null;
  
  // Gradient configuration
  gradientTypes: GradientType[] = ['linear', 'radial', 'conic', 'repeating-linear', 'repeating-radial', 'repeating-conic'];
  selectedGradientType: GradientType = 'linear';
  gradientColors: string[] = ['#3f51b5', '#c0af4b'];
  gradientAngle = '90deg';
  gradientDirection = 'to right';
  generatedGradient = '';
  
  // Predefined gradient presets
  gradientPresets: GradientPreset[] = [
    { name: 'Sunset', type: 'linear', colors: ['#ff6b6b', '#feca57', '#ee5a6f'], direction: 'to right' },
    { name: 'Ocean', type: 'linear', colors: ['#4facfe', '#00f2fe'], direction: 'to right' },
    { name: 'Forest', type: 'linear', colors: ['#11998e', '#38ef7d'], direction: 'to right' },
    { name: 'Purple Haze', type: 'linear', colors: ['#a18cd1', '#fbc2eb'], direction: 'to right' },
    { name: 'Fire', type: 'radial', colors: ['#ff0844', '#ffb199'], direction: 'circle' },
    { name: 'Cosmic', type: 'conic', colors: ['#667eea', '#764ba2', '#f093fb'], angle: '0deg' },
  ];
  
  // Shadow configuration
  shadowBlur = 8;
  shadowSpread = 2;
  shadowColor = '#000000';
  shadowOpacity = 0.3;
  generatedShadow = '';
  
  // Predefined shadow presets
  shadowPresets: ShadowPreset[] = [
    { name: 'Subtle', value: '0 2px 4px rgba(0, 0, 0, 0.1)' },
    { name: 'Medium', value: '0 4px 6px rgba(0, 0, 0, 0.15)' },
    { name: 'Large', value: '0 10px 15px rgba(0, 0, 0, 0.2)' },
    { name: 'Glow Accent', value: '0 0 20px var(--accent)' },
    { name: 'Glow Complement', value: '0 0 20px var(--complement)' },
    { name: 'Multi Glow', value: '0 0 24px 8px var(--accent), 0 0 48px 16px var(--complement)' },
  ];
  
  private destroy$ = new Subject<void>();
  
  constructor(private themeService: ThemeService) {}
  
  ngOnInit(): void {
    // Load current theme settings
    this.currentTheme = this.themeService.getTheme();
    this.accentColor = this.themeService.getAccentColor();
    
    // Load available palettes
    this.themeService.availablePalettes$
      .pipe(takeUntil(this.destroy$))
      .subscribe(palettes => {
        this.availablePalettes = palettes;
      });
    
    this.themeService.themeColors$
      .pipe(takeUntil(this.destroy$))
      .subscribe(colors => {
        if (colors) {
          this.accentColor = colors.accent;
          this.complementaryColor = colors.complementary;
        }
      });
    
    this.updateGradient();
    this.updateShadow();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  // Theme methods
  toggleTheme(): void {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.themeService.setTheme(this.currentTheme);
  }
  
  updateAccentColor(): void {
    this.themeService.setAccentColor(this.accentColor);
    this.updateGradientColors();
  }
  
  updateComplementaryColor(): void {
    this.themeService.setAccentColor(this.accentColor, this.complementaryColor);
    this.updateGradientColors();
  }
  
  // Gradient methods
  addGradientColor(): void {
    this.gradientColors.push('#ffffff');
    this.updateGradient();
  }
  
  removeGradientColor(index: number): void {
    if (this.gradientColors.length > 2) {
      this.gradientColors.splice(index, 1);
      this.updateGradient();
    }
  }
  
  updateGradientColor(index: number, color: string): void {
    this.gradientColors[index] = color;
    this.updateGradient();
  }
  
  updateGradient(): void {
    const builder = new GradientBuilder();
    builder.setType(this.selectedGradientType);
    
    const options: any = { colors: this.gradientColors };
    
    if (this.selectedGradientType.includes('linear')) {
      options.direction = this.gradientDirection;
      options.angle = this.gradientAngle;
    } else if (this.selectedGradientType.includes('conic')) {
      options.angle = this.gradientAngle;
    }
    
    builder.setOptions(options);
    this.generatedGradient = builder.build();
  }
  
  applyGradientPreset(preset: GradientPreset): void {
    this.selectedGradientType = preset.type;
    this.gradientColors = [...preset.colors];
    if (preset.angle) {
      this.gradientAngle = preset.angle;
    }
    if (preset.direction) {
      this.gradientDirection = preset.direction;
    }
    this.updateGradient();
  }
  
  copyGradientToClipboard(): void {
    navigator.clipboard.writeText(this.generatedGradient);
  }
  
  private updateGradientColors(): void {
    if (this.gradientColors.length >= 2) {
      this.gradientColors[0] = this.accentColor;
      this.gradientColors[1] = this.complementaryColor;
      this.updateGradient();
    }
  }
  
  // Shadow methods
  updateShadow(): void {
    const rgba = this.hexToRgba(this.shadowColor, this.shadowOpacity);
    this.generatedShadow = `0 0 ${this.shadowBlur}px ${this.shadowSpread}px ${rgba}`;
  }
  
  applyShadowPreset(preset: ShadowPreset): void {
    this.generatedShadow = preset.value;
  }
  
  copyShadowToClipboard(): void {
    navigator.clipboard.writeText(this.generatedShadow);
  }
  
  // Utility methods
  private hexToRgba(hex: string, opacity: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  
  getGradientStyle(): { [key: string]: string } {
    return {
      background: this.generatedGradient,
      width: '100%',
      height: '100px',
      borderRadius: '8px',
    };
  }
  
  getShadowStyle(): { [key: string]: string } {
    return {
      background: 'var(--background, #fff)',
      width: '100%',
      height: '100px',
      borderRadius: '8px',
      boxShadow: this.generatedShadow,
    };
  }

  // Palette management methods
  getEmptyPalette(): ColorPalette {
    return {
      name: '',
      description: '',
      accent: '#3f51b5',
      complementary: '#c0af4b',
      tertiary: '#7e57c2',
      background: {
        light: '#ffffff',
        dark: '#1a1a2e'
      },
      foreground: {
        light: '#212121',
        dark: '#ffffff'
      }
    };
  }

  isCurrentPalette(palette: ColorPalette): boolean {
    const currentPalette = this.themeService.getCurrentPalette();
    return currentPalette?.name === palette.name;
  }

  isCustomPalette(palette: ColorPalette): boolean {
    return !PREDEFINED_PALETTES.some(p => p.name === palette.name);
  }

  applyPalette(palette: ColorPalette): void {
    this.themeService.setPalette(palette.name);
  }

  startCreatePalette(): void {
    this.paletteFormMode = 'create';
    this.paletteFormData = this.getEmptyPalette();
    this.paletteFormError = null;
    this.originalPaletteName = null;
    this.showPaletteForm = true;
  }

  startEditPalette(palette: ColorPalette): void {
    this.paletteFormMode = 'edit';
    this.paletteFormData = { ...palette };
    this.paletteFormError = null;
    this.originalPaletteName = palette.name;
    this.showPaletteForm = true;
  }

  cancelPaletteForm(): void {
    this.showPaletteForm = false;
    this.paletteFormData = this.getEmptyPalette();
    this.paletteFormError = null;
    this.originalPaletteName = null;
  }

  savePalette(): void {
    this.paletteFormError = null;

    // Validate form data
    if (!this.paletteFormData.name || !this.paletteFormData.name.trim()) {
      this.paletteFormError = 'Palette name is required';
      return;
    }

    try {
      if (this.paletteFormMode === 'create') {
        this.themeService.createCustomPalette(this.paletteFormData);
      } else if (this.paletteFormMode === 'edit' && this.originalPaletteName) {
        this.themeService.updateCustomPalette(this.originalPaletteName, this.paletteFormData);
      }
      this.cancelPaletteForm();
    } catch (error: any) {
      this.paletteFormError = error.message || 'Failed to save palette';
    }
  }

  deletePalette(palette: ColorPalette): void {
    if (confirm(`Are you sure you want to delete the palette "${palette.name}"?`)) {
      try {
        this.themeService.deleteCustomPalette(palette.name);
      } catch (error: any) {
        alert(error.message || 'Failed to delete palette');
      }
    }
  }
}
