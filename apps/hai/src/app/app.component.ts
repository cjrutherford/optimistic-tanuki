import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HaiAboutTagComponent } from '@optimistic-tanuki/hai-ui';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { TitleBarComponent } from './components/title-bar/title-bar.component';

@Component({
  selector: 'hai-root',
  standalone: true,
  imports: [RouterModule, TitleBarComponent, HaiAboutTagComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  readonly title = 'hai';
  readonly haiAboutConfig = {
    appId: 'hai',
    appName: 'HAI',
    appTagline: 'Software, cloud, and personal-cloud systems.',
    appDescription:
      'Hopeful Aspirations Integrators builds software systems, cloud platforms, and personal cloud tooling for people who want durable, owned computing.',
    appUrl: '/hai',
  };

  private readonly themeService = inject(ThemeService);
  private readonly platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const hasStoredPersonalityTheme = !!localStorage.getItem(
        'optimistic-tanuki-personality-theme'
      );

      if (!hasStoredPersonalityTheme) {
        this.themeService.setTheme('light');
        this.themeService.setPersonality('foundation');
        this.themeService.setPrimaryColor('#204434');
        return;
      }
    }

    this.themeService.setTheme(this.themeService.getTheme());
  }
}
