import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-ui';

@Component({
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'christopherrutherford-net';
  constructor(private readonly themeService: ThemeService){}

  ngOnInit() {
    this.themeService.setTheme('dark');
    this.themeService.setAccentColor('#1abc9c', '#89CFF0');
  }
}
