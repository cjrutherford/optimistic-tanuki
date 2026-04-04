import { Component, PLATFORM_ID, inject, OnInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HaiAboutTagComponent } from '@optimistic-tanuki/hai-ui';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { AuroraRibbonComponent } from '@optimistic-tanuki/motion-ui';

@Component({
  imports: [RouterModule, HaiAboutTagComponent, AuroraRibbonComponent],
  selector: 'store-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private themeService = inject(ThemeService);
  private readonly platformId = inject(PLATFORM_ID);
  protected title = 'store-client';
  protected readonly haiAboutConfig = {
    appId: 'store-client',
    appName: 'Store',
    appTagline: 'Bookings, donations, and storefront flows.',
    appDescription:
      'Store is an HAI commerce shell for bookings, purchases, donations, and related customer-facing purchase flows.',
    appUrl: '/store',
  };

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

  ngOnInit(): void {
    this.themeService.setTheme('dark');
    this.themeService.setPersonality('playful');
    this.themeService.setPrimaryColor('#c2185b');
  }
}
