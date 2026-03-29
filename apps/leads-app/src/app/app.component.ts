import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

@Component({
  imports: [RouterModule],
  selector: 'app-root',
  template: '<router-outlet></router-outlet>',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  protected title = 'leads-app';
  private readonly themeService = inject(ThemeService);
  private readonly platformId = inject(PLATFORM_ID);

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.themeService.setPersonality('control-center');
    }
  }
}
