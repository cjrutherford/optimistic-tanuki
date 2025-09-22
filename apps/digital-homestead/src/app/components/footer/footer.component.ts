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
    // Using standardized local variables with fallbacks
    '[style.--local-background]': 'background',
    '[style.--local-foreground]': 'foreground',
    '[style.--local-accent]': 'accent',
    '[style.--local-complement]': 'complement',
    '[style.--local-border-color]': 'borderColor',
    '[style.--local-border-gradient]': 'borderGradient',
    '[style.--local-transition-duration]': 'transitionDuration',
  }
})
export class FooterComponent extends Themeable{
  
  override applyTheme(colors: ThemeColors): void {
    // Use standardized color assignments
    this.background = `linear-gradient(30deg, ${colors.accent}, ${colors.background})`;
    this.accent = colors.accent;
    this.borderColor = colors.complementary;
    
    // Use standardized gradient names  
    if(this.theme === 'dark') {
      this.borderGradient = colors.complementaryGradients['dark'];
    } else {
      this.borderGradient = colors.complementaryGradients['light'];
    }
    
    this.foreground = colors.foreground;
    this.complement = colors.complementary;
    this.transitionDuration = '0.15s'; // Use standardized duration
    this.borderColor = colors.complementary;
  }
}
