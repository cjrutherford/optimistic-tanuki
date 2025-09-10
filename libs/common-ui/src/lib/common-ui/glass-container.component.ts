import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-ui';

export const hexToRgb = (hex: string): string => {
  // Remove the leading '#' if present
  hex = hex.replace(/^#/, '');

  // Parse the hex string into its RGB components
  const bigint = parseInt(hex, 16);
  let r: number, g: number, b: number;

  if (hex.length === 6) {
    r = (bigint >> 16) & 255;
    g = (bigint >> 8) & 255;
    b = bigint & 255;
  } else if (hex.length === 3) {
    r = ((bigint >> 8) & 15) * 17;
    g = ((bigint >> 4) & 15) * 17;
    b = (bigint & 15) * 17;
  } else {
    throw new Error('Invalid hex color format');
  }

  return `${r}, ${g}, ${b}`;
}

@Component({
  selector: 'otui-glass-container',
  imports: [CommonModule],
  templateUrl: './glass-container.component.html',
  styleUrl: './glass-container.component.scss',
  host: {
    '[style.--background]': 'background',
    '[style.--foreground]': 'foreground',
    '[style.--accent]': 'accent',
    '[style.--complement]': 'complement',
    '[style.--radius]': 'radius',
    '[style.--blur]': 'blur',
    '[style.--border]': 'borderColor',
    '[style.--shadow-1]': 'shadow1',
    '[style.--shadow-2]': 'shadow2',

  }
})
export class GlassContainerComponent extends Themeable {
  radius = '10px';
  blur = '10px';
  shadow1 = 'rgba(0, 0, 0, 0.1)';
  shadow2 = 'rgba(0, 0, 0, 0.1)';

  override applyTheme(colors: ThemeColors): void {
    this.background = `linear-gradient(to bottom, rgba(${hexToRgb(colors.accent)}, 0.15), rgba(${hexToRgb(colors.complementary)}, 0.06)), rgba(${hexToRgb(colors.background)}, 0.5)`;
    this.foreground = hexToRgb(colors.foreground);
    this.accent = hexToRgb(colors.accent);
    this.complement = hexToRgb(colors.complementary);
    this.shadow1 = `rgba(${hexToRgb(colors.accent)}, 0.3)`;
    this.shadow2 = `rgba(${hexToRgb(colors.complementary)}, 0.1)`;

    if (this.theme === 'dark') {
      this.borderGradient = colors.accentGradients['dark'];
      this.borderColor = `2px solid ${colors.complementaryShades[2][0]}`;
    } else {
      this.borderGradient = colors.accentGradients['light'];
      this.borderColor = `2px solid ${colors.complementaryShades[2][1]}`;
    }
    this.transitionDuration = '0.3s';
  }
}
