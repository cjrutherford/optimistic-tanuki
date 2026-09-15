import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

// The architect personality comes from `provideProductTheme('learning')`.
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
})
export class AppComponent {}
