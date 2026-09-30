import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PersonalityBackdropComponent } from '@optimistic-tanuki/theme-ui';

@Component({
  imports: [RouterModule, PersonalityBackdropComponent],
  selector: 'app-root',
  template: `<lib-personality-backdrop /><router-outlet></router-outlet>`,
  styleUrl: './app.component.scss',
})
export class AppComponent {}
