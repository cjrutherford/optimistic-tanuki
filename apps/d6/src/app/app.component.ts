import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TitleBarComponent } from './components/title-bar/title-bar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TitleBarComponent],
  template: `
    <app-title-bar></app-title-bar>
    <main class="main-content">
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [`
    .main-content {
      padding-top: 64px;
      min-height: 100vh;
    }
  `],
})
export class AppComponent {}
