import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-ui';

@Component({
  selector: 'otui-tile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tile">
      <ng-content></ng-content>
    </div>
  `,
  styleUrls: ['./tile.component.scss'],
  host: {
    'class.theme': 'theme',
    '[style.--background]': 'background',
    '[style.--foreground]': 'foreground',
    '[style.--accent]': 'accent',
    '[style.--complement]': 'complement',
    '[style.--border-color]': 'borderColor',
    '[style.--border-gradient]': 'borderGradient',
    '[style.--transition-duration]': 'transitionDuration',
  },
})
export class TileComponent extends Themeable {
  @Input() variant: 'default' | 'info' | 'warning' | 'error' | 'success' =
    'default';

  @Input() isRow = false;

  override applyTheme(colors: ThemeColors): void {
    this.transitionDuration = '0.3s';

    switch (this.variant) {
      case 'default':
        this.applyDefaultTheme(colors);
        break;
      case 'info':
        this.applyInfoTheme(colors);
        break;
      case 'warning':
        this.applyWarningTheme(colors);
        break;
      case 'error':
        this.applyErrorTheme(colors);
        break;
      case 'success':
        this.applySuccessTheme(colors);
        break;
    }
  }

  private applyDefaultTheme(colors: ThemeColors): void {
    this.background = `radial-gradient(ellipse, ${colors.background}, ${colors.accent})`;
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.complement = colors.complementary;
    if (this.theme === 'dark') {
      this.borderGradient = colors.accentGradients['dark'];
      this.borderColor = colors.complementaryShades[2][0];
    } else {
      this.borderGradient = colors.accentGradients['light'];
      this.borderColor = colors.complementaryShades[2][1];
    }
  }

  private applyInfoTheme(colors: ThemeColors): void {
    this.background = `radial-gradient(ellipse, ${colors.accent}, ${colors.background})`;
    this.foreground = colors.foreground;
    this.accent = colors.complementary;
    this.complement = colors.accent;
    if (this.theme === 'dark') {
      this.borderGradient = colors.accentGradients['dark'];
      this.borderColor = colors.complementaryShades[4][0];
    } else {
      this.borderGradient = colors.accentGradients['light'];
      this.borderColor = colors.complementaryShades[4][1];
    }
  }

  private applyWarningTheme(colors: ThemeColors): void {
    this.background = `radial-gradient(ellipse, ${colors.warning}, ${colors.background})`;
    this.foreground = colors.foreground;
    this.accent = colors.complementary;
    this.complement = colors.warning;
    if (this.theme === 'dark') {
      this.borderGradient = colors.warningGradients['dark'];
      this.borderColor = colors.complementaryShades[6][0];
    } else {
      this.borderGradient = colors.warningGradients['light'];
      this.borderColor = colors.complementaryShades[6][1];
    }
  }

  private applyErrorTheme(colors: ThemeColors): void {
    this.background = `radial-gradient(ellipse, ${colors.danger}, ${colors.background})`;
    this.foreground = colors.foreground;
    this.accent = colors.complementary;
    this.complement = colors.danger;
    if (this.theme === 'dark') {
      this.borderGradient = colors.dangerGradients['dark'];
      this.borderColor = colors.complementaryShades[8][0];
    } else {
      this.borderGradient = colors.dangerGradients['light'];
      this.borderColor = colors.complementaryShades[8][1];
    }
  }

  private applySuccessTheme(colors: ThemeColors): void {
    this.background = `radial-gradient(ellipse, ${colors.success}, ${colors.background})`;
    this.foreground = colors.foreground;
    this.accent = colors.complementary;
    this.complement = colors.success;
    if (this.theme === 'dark') {
      this.borderGradient = colors.successGradients['dark'];
      this.borderColor = colors.complementaryShades[10][0];
    } else {
      this.borderGradient = colors.successGradients['light'];
      this.borderColor = colors.complementaryShades[10][1];
    }
  }
}
