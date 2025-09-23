import { Component } from '@angular/core';

import { ProfilePhotoComponent } from '@optimistic-tanuki/profile-ui';
import { CardComponent, HeadingComponent, TileComponent } from '@optimistic-tanuki/common-ui';
import { Themeable, ThemeColors, ThemeService } from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'app-about',
  host: {
    // Using standardized local variables with fallbacks
    '[style.--local-background]': 'background',
    '[style.--local-foreground]': 'foreground',
    '[style.--local-accent]': 'accent',
    '[style.--local-complement]': 'complement',
    '[style.--local-border-color]': 'borderColor',
    '[style.--local-border-gradient]': 'borderGradient'
  },
  providers: [ThemeService],
  imports: [HeadingComponent, CardComponent],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent extends Themeable{
  override applyTheme(colors: ThemeColors): void {
    // Use standardized color assignments
    this.complement = colors.complementary;
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

  constructor(themeService: ThemeService) {
    super(themeService);
    // Set a predefined palette instead of manual colors
    themeService.setTheme('dark');
    themeService.setPalette('Forest Dream'); // Use predefined palette
  }
}
