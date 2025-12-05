import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TitleBarComponent } from './components/title-bar/title-bar.component';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { GradientBuilder } from '@optimistic-tanuki/common-ui';
import { hexToRgb } from 'libs/common-ui/src/lib/common-ui/glass-container.component';

@Component({
  imports: [RouterModule, TitleBarComponent],
  selector: 'dh-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  host: {
    '[style.--heading-gradient]': 'headingGradient',
  },
})
export class AppComponent implements OnInit {
  title = 'digital-homestead';
  headingGradient = 'linear-gradient(90deg, #ff7e5f, #feb47b)'; // Example gradient

  constructor(
    private readonly themeService: ThemeService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.themeService.setTheme('dark');
    // Use predefined palette instead of manual colors
    this.themeService.setPalette('Cyberpunk Neon'); // Matches the digital homestead aesthetic

    this.themeService.themeColors$.subscribe({
      next: (colors) => {
        if (!colors || !isPlatformBrowser(this.platformId)) return;
        const accentRgb = hexToRgb(colors.accent);
        const complementRgb = hexToRgb(colors.complementary);
        const accentRgba = `rgba(${accentRgb}, 0.9)`;
        const complementRgba = `rgba(${complementRgb}, 0.9)`;

        this.headingGradient = new GradientBuilder()
          .setType('linear')
          .setOptions({
            direction: '180deg',
            colors: [accentRgba, complementRgba],
          })
          .build();

        // Only set app-specific variables, theme colors are handled by ThemeService
        const backgroundPattern = `
<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
  <path fill="${colors.tertiary}2a" d="M0 17.83V0h17.83a3 3 0 0 1-5.66 2H5.9A5 5 0 0 1 2 5.9v6.27a3 3 0 0 1-2 5.66zm0 18.34a3 3 0 0 1 2 5.66v6.27A5 5 0 0 1 5.9 52h6.27a3 3 0 0 1 5.66 0H0V36.17zM36.17 52a3 3 0 0 1 5.66 0h6.27a5 5 0 0 1 3.9-3.9v-6.27a3 3 0 0 1 0-5.66V52H36.17zM0 31.93v-9.78a5 5 0 0 1 3.8.72l4.43-4.43a3 3 0 1 1 1.42 1.41L5.2 24.28a5 5 0 0 1 0 5.52l4.44 4.43a3 3 0 1 1-1.42 1.42L3.8 31.2a5 5 0 0 1-3.8.72zm52-14.1a3 3 0 0 1 0-5.66V5.9A5 5 0 0 1 48.1 2h-6.27a3 3 0 0 1-5.66-2H52v17.83zm0 14.1a4.97 4.97 0 0 1-1.72-.72l-4.43 4.44a3 3 0 1 1-1.41-1.42l4.43-4.43a5 5 0 0 1 0-5.52l-4.43-4.43a3 3 0 1 1 1.41-1.41l4.43 4.43c.53-.35 1.12-.6 1.72-.72v9.78zM22.15 0h9.78a5 5 0 0 1-.72 3.8l4.44 4.43a3 3 0 1 1-1.42 1.42L29.8 5.2a5 5 0 0 1-5.52 0l-4.43 4.44a3 3 0 1 1-1.41-1.42l4.43-4.43a5 5 0 0 1-.72-3.8zm0 52c.13-.6.37-1.19.72-1.72l-4.43-4.43a3 3 0 1 1 1.41-1.41l4.43 4.43a5 5 0 0 1 5.52 0l4.43-4.43a3 3 0 1 1 1.42 1.41l-4.44 4.43c.36.53.6 1.12.72 1.72h-9.78zm9.75-24a5 5 0 0 1-3.9 3.9v6.27a3 3 0 1 1-2 0V31.9a5 5 0 0 1-3.9-3.9h-6.27a3 3 0 1 1 0-2h6.27a5 5 0 0 1 3.9-3.9v-6.27a3 3 0 1 1 2 0v6.27a5 5 0 0 1 3.9 3.9h6.27a3 3 0 1 1 0 2H31.9z"></path>
</svg>
      `;
        const encodedPattern = encodeURIComponent(backgroundPattern)
          .replace(/'/g, '%27')
          .replace(/"/g, '%22')
          .replace(/#/g, '%23')
          .replace(/</g, '%3C')
          .replace(/>/g, '%3E')
          .replace(/\s+/g, ' '); // Minimize whitespace

        // Set app-specific pattern variable (theme colors are handled by ThemeService)
        document.documentElement.style.setProperty(
          '--background-pattern',
          `url("data:image/svg+xml,${encodedPattern}")`
        );
      },
    });
  }
}
