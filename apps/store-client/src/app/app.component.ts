import { Component, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HaiAboutTagComponent } from '@optimistic-tanuki/hai-ui';
import { PersonalitySceneComponent } from '@optimistic-tanuki/motion-ui';

@Component({
  imports: [RouterModule, HaiAboutTagComponent, PersonalitySceneComponent],
  selector: 'store-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
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
}
