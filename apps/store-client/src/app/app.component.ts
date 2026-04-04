import { Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HaiAboutTagComponent } from '@optimistic-tanuki/hai-ui';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

@Component({
  imports: [RouterModule, HaiAboutTagComponent],
  selector: 'store-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private themeService = inject(ThemeService);
  protected title = 'store-client';
  protected readonly haiAboutConfig = {
    appId: 'store-client',
    appName: 'Store',
    appTagline: 'Bookings, donations, and storefront flows.',
    appDescription:
      'Store is an HAI commerce shell for bookings, purchases, donations, and related customer-facing purchase flows.',
    appUrl: '/store',
  };

  ngOnInit(): void {
    this.themeService.setTheme('dark');
    this.themeService.setPersonality('playful');
    this.themeService.setPrimaryColor('#c2185b');
  }
}
