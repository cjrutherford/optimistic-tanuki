import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PersonalityBackdropComponent } from '@optimistic-tanuki/theme-ui';

// The architect personality comes from `provideProductTheme('learning')`.
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PersonalityBackdropComponent],
  template: '<lib-personality-backdrop /><router-outlet></router-outlet>',
})
export class AppComponent {}
