import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

@Component({
  imports: [RouterModule],
  selector: 'store-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private themeService = inject(ThemeService);
  protected title = 'store-client';

  ngOnInit(): void {
    this.themeService.setTheme('dark');
    this.themeService.setPalette('Retro Gaming');
  }
}
