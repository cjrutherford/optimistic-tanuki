import { Component, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HaiAboutTagComponent } from '@optimistic-tanuki/hai-ui';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { TopographicDriftComponent } from '@optimistic-tanuki/motion-ui';

/**
 * Root AppComponent now delegates configuration loading to AppResolverComponent
 * This simplifies the architecture and enables multi-tenant support via routing
 */
@Component({
  imports: [
    CommonModule,
    RouterModule,
    HaiAboutTagComponent,
    TopographicDriftComponent,
  ],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private readonly themeService = inject(ThemeService);
  private readonly platformId = inject(PLATFORM_ID);
  protected title = 'configurable-client';
  protected readonly haiAboutConfig = {
    appId: 'configurable-client',
    appName: 'Configurable Client',
    appTagline: 'Multi-tenant configurable HAI application shells.',
    appDescription:
      'Configurable Client is the HAI app shell for tenant-driven and dynamically composed application experiences.',
    appUrl: '/configurable-client',
  };

  constructor() {
    if (this.isBrowser) {
      this.themeService.setTheme('light');
      this.themeService.setPersonality('foundation');
      this.themeService.setPrimaryColor('#356c91');
    }
  }

  get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  get reducedMotion(): boolean {
    if (!this.isBrowser) {
      return true;
    }

    if (typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
