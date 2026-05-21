import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

@Component({
  standalone: true,
  imports: [RouterModule],
  selector: 'app-root',
  template: `<router-outlet></router-outlet>`,
  styles: [`:host { display: block; }`],
})
export class AppComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly themeService = inject(ThemeService);

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.themeService.setPersonality('professional');
      this.themeService.setPrimaryColor('#1f7a63');
    }
  }
}