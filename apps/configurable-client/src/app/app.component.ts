import { Component, OnInit, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { ConfigurationService } from './services/configuration.service';

@Component({
  imports: [CommonModule, RouterModule],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  protected title = 'configurable-client';
  loading = true;
  error: string | null = null;

  constructor(
    private configService: ConfigurationService,
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    // Only load configuration in browser, not during SSR
    if (isPlatformBrowser(this.platformId)) {
      // For POC, we'll use a hardcoded app name or domain
      // In production, this would be determined from the URL/environment
      
      this.route.queryParams.subscribe(params => {
        const appName = params['appName'] || 'demo-app';
        
        this.configService.getConfigurationByName(appName).subscribe({
          next: (config) => {
            this.configService.setConfiguration(config);
            this.loading = false;
            
            // Apply theme configuration
            this.applyTheme(config.theme);
          },
          error: (err) => {
            console.error('Failed to load configuration:', err);
            this.error = 'Failed to load application configuration';
            this.loading = false;
          },
        });
      });
    } else {
      // During SSR, just show loading state
      this.loading = false;
    }
  }

  private applyTheme(theme: any): void {
    const root = document.documentElement;
    if (theme.primaryColor) {
      root.style.setProperty('--primary-color', theme.primaryColor);
    }
    if (theme.secondaryColor) {
      root.style.setProperty('--secondary-color', theme.secondaryColor);
    }
    if (theme.backgroundColor) {
      root.style.setProperty('--background-color', theme.backgroundColor);
    }
    if (theme.textColor) {
      root.style.setProperty('--text-color', theme.textColor);
    }
    if (theme.fontFamily) {
      root.style.setProperty('--font-family', theme.fontFamily);
    }
  }
}
