import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from './theme.service';
import { PREDEFINED_PALETTES } from './theme-palettes';

@Component({
  selector: 'theme-palette-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="palette-selector">
      <h3>Theme Palettes</h3>
      <div class="palette-grid">
        @for (palette of palettes; track palette.name) {
          <div 
            class="palette-card"
            [class.active]="isCurrentPalette(palette.name)"
            (click)="selectPalette(palette.name)"
          >
            <div class="palette-colors">
              <div class="color-swatch" [style.background-color]="palette.accent" title="Accent"></div>
              <div class="color-swatch" [style.background-color]="palette.complementary" title="Complementary"></div>
              @if (palette.tertiary) {
                <div class="color-swatch" [style.background-color]="palette.tertiary" title="Tertiary"></div>
              }
            </div>
            <div class="palette-info">
              <h4>{{ palette.name }}</h4>
              <p>{{ palette.description }}</p>
            </div>
          </div>
        }
      </div>
      
      <div class="custom-mode">
        <button 
          class="custom-btn"
          [class.active]="themeService.getPaletteMode() === 'custom'"
          (click)="enableCustomMode()"
        >
          Custom Colors
        </button>
        @if (themeService.getPaletteMode() === 'custom') {
          <div class="custom-inputs">
            <label>
              Accent Color:
              <input 
                type="color" 
                [value]="themeService.getAccentColor()"
                (input)="updateAccentColor($event)"
              />
            </label>
            <label>
              Complementary Color:
              <input 
                type="color" 
                [value]="themeService.getComplementaryColor()"
                (input)="updateComplementaryColor($event)"
              />
            </label>
          </div>
        }
      </div>
      
      <div class="theme-toggle">
        <button (click)="toggleTheme()">
          Switch to {{ themeService.getTheme() === 'light' ? 'Dark' : 'Light' }} Mode
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./palette-selector.component.scss']
})
export class PaletteSelectorComponent {
  themeService = inject(ThemeService);
  palettes = PREDEFINED_PALETTES;

  selectPalette(paletteName: string) {
    this.themeService.setPalette(paletteName);
  }

  isCurrentPalette(paletteName: string): boolean {
    const currentPalette = this.themeService.getCurrentPalette();
    return currentPalette?.name === paletteName;
  }

  enableCustomMode() {
    this.themeService.setAccentColor(this.themeService.getAccentColor());
  }

  updateAccentColor(event: Event) {
    const input = event.target as HTMLInputElement;
    this.themeService.setAccentColor(input.value);
  }

  updateComplementaryColor(event: Event) {
    const input = event.target as HTMLInputElement;
    this.themeService.setAccentColor(this.themeService.getAccentColor(), input.value);
  }

  toggleTheme() {
    const currentTheme = this.themeService.getTheme();
    this.themeService.setTheme(currentTheme === 'light' ? 'dark' : 'light');
  }
}