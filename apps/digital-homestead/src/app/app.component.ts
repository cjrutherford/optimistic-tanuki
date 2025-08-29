import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TitleBarComponent } from './components/title-bar/title-bar.component';

@Component({
  imports: [RouterModule, TitleBarComponent],
  selector: 'dh-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'digital-homestead';
}
