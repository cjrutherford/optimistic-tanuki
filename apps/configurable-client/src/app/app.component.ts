import { Component, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HaiAboutTagComponent } from '@optimistic-tanuki/hai-ui';
import { TopographicDriftComponent } from '@optimistic-tanuki/motion-ui';

/**
 * Root AppComponent now delegates configuration loading to AppResolverComponent
 * This simplifies the architecture and enables multi-tenant support via routing.
 *
 * Theme application is owned entirely by `AppResolverComponent` →
 * `TenantThemeService`; this component intentionally does NOT call
 * `ThemeService` directly anymore, to avoid racing the resolver's
 * awaited tenant-config apply (see TenantThemeService class-level
 * comment for the ordering contract).
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
