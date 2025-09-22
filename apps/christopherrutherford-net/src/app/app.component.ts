import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ThemeColors, ThemeService } from '@optimistic-tanuki/theme-ui';

@Component({
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  accent = '#1abc9c';
  complementary = '#89CFF0';
  tertiary = '#e73cbf';
  title = 'christopherrutherford.net';
  constructor(private readonly themeService: ThemeService){}

  ngOnInit() {
    this.themeService.setTheme('dark');
    // Use predefined palette instead of manual colors
    this.themeService.setPalette('Ocean Breeze'); // Matches the teal theme
    
    this.themeService.themeColors$.subscribe({ next: (colors: ThemeColors | undefined) => {
      if(!colors) return;
      
      // Only set custom app-specific variables, theme colors are handled by ThemeService
      const backgroundPattern = `
        <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
          <g fill="${colors.tertiary}" fill-opacity="0.1">
            <path fill-rule="evenodd" d="M72 10H40L16 20H0v8h16l24-14h32l24 14h16v-8H96L72 10zm0-8H40L16 4H0v8h16l24-6h32l24 6h16V4H96L72 2zm0 84H40l-24-6H0v8h16l24 2h32l24-2h16v-8H96l-24 6zm0-8H40L16 64H0v8h16l24 10h32l24-10h16v-8H96L72 78zm0-12H40L16 56H0v4h16l24 14h32l24-14h16v-4H96L72 66zm0-16H40l-24-2H0v4h16l24 6h32l24-6h16v-4H96l-24 2zm0-16H40l-24 6H0v4h16l24-2h32l24 2h16v-4H96l-24-6zm0-16H40L16 32H0v4h16l24-10h32l24 10h16v-4H96L72 18z"/>
          </g>
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
    }});
  }
}
