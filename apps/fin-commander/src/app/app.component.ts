import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { ProfileContext } from './profile.context';
import { TitleBarComponent } from './components/title-bar/title-bar.component';
import { TenantContextService } from './tenant-context.service';
import { HaiAboutTagComponent } from '@optimistic-tanuki/hai-ui';

@Component({
  selector: 'fc-root',
  standalone: true,
  imports: [RouterOutlet, TitleBarComponent, HaiAboutTagComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  readonly title = 'fin-commander';

  haiAboutConfig = {
    appId: 'fin-commander',
    appName: 'Fin Commander',
    appTagline: 'Navigation for personal finances.',
    appDescription:
      'Fin Commander helps you navigate your personal finances with clarity and confidence.',
    appUrl: '/fin-commander',
  };

  private readonly themeService = inject(ThemeService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly profileContext = inject(ProfileContext);
  private readonly tenantContext = inject(TenantContextService);

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const hasStoredPersonalityTheme = !!localStorage.getItem(
        'optimistic-tanuki-personality-theme'
      );

      if (!hasStoredPersonalityTheme) {
        this.themeService.setTheme('light');
        this.themeService.setPersonality('fin-commander-shark');
        this.themeService.setPrimaryColor('#0d5f73');
        return;
      }
    }

    this.themeService.setTheme(this.themeService.getTheme());

    if (this.profileContext.isAuthenticated()) {
      void this.profileContext.loadProfile();
    }
  }
}
