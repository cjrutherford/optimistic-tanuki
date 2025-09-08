import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeadingComponent } from '@optimistic-tanuki/common-ui';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-ui';
import { Subject } from 'rxjs';

@Component({
  selector: 'dh-footer',
  imports: [CommonModule, HeadingComponent],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
  host: {
    '[style.--background]': 'background',
    '[style.--foreground]': 'foreground',
    '[style.--accent]': 'accent',
    '[style.--complement]': 'complement',
    '[style.--border-color]': 'borderColor',
    '[style.--border-gradient]': 'borderGradient',
    '[style.--transition-duration]': 'transitionDuration',
  }
})
export class FooterComponent extends Themeable{
  
  override applyTheme(colors: ThemeColors): void {
    this.background = `linear-gradient(30deg, ${colors.accent}, ${colors.background})`
    this.accent = colors.accent;
    this.borderColor = colors.complementary;
    if(this.theme === 'dark') {
      this.borderGradient = colors.complementaryGradients['dark']  
    } else {
      this.borderGradient = colors.complementaryGradients['light']
    }
    this.foreground = colors.foreground;
    this.complement = colors.complementary;
    this.transitionDuration = '0.5s';
    this.borderColor = colors.complementary;
  }
}
