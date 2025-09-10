import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfilePhotoComponent } from '@optimistic-tanuki/profile-ui';
import { CardComponent, HeadingComponent, TileComponent } from '@optimistic-tanuki/common-ui';
import { Themeable, ThemeColors, ThemeService } from '@optimistic-tanuki/theme-ui';

@Component({
  selector: 'app-about',
  host: {
    '[style.--background]': 'background',
    '[style.--foreground]': 'foreground',
    '[style.--accent]': 'accent',
    '[style.--complement]': 'complement',
    '[style.--border-color]': 'borderColor',
    '[style.--border-gradient]': 'borderGradient'
  },
  providers: [ThemeService],
  imports: [CommonModule, HeadingComponent, CardComponent],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent extends Themeable{
  override applyTheme(colors: ThemeColors): void {
    this.complement = colors.complementary;
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

  constructor(themeService: ThemeService) {
    super(themeService);
    themeService.setTheme('dark');
    themeService.setAccentColor('#1abc9c', '#89CFF0');
  }
}
