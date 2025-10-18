import { Component } from '@angular/core';
import { ThemeDesignerComponent } from '@optimistic-tanuki/theme-ui';

@Component({
  selector: 'app-settings',
  imports: [ThemeDesignerComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  title = 'Theme Settings';
}
