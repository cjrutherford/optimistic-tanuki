import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
})
export class AppComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly themeService = inject(ThemeService);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Architect is the raw, structural, monospace personality, and it is what
    // this surface already looked like before it had a name for it.
    this.themeService.setPersonality('architect');
    this.themeService.setPrimaryColor('#0d7a66');
  }
}
