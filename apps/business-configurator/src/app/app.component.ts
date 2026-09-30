import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PersonalityBackdropComponent } from '@optimistic-tanuki/theme-ui';

@Component({
  standalone: true,
  imports: [RouterModule, PersonalityBackdropComponent],
  selector: 'app-root',
  template: `<lib-personality-backdrop /><router-outlet></router-outlet>`,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class AppComponent {}
