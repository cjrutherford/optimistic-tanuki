import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent, CardComponent, TileComponent, HeadingComponent } from '@optimistic-tanuki/common-ui';
import { ThemeToggleComponent } from '@optimistic-tanuki/theme-ui';

@Component({
  selector: 'otui-app-bar',
  standalone: true,
  imports: [CommonModule, ButtonComponent, CardComponent, TileComponent, HeadingComponent, ThemeToggleComponent],
  templateUrl: './app-bar.component.html',
  styleUrls: ['./app-bar.component.scss'],
})
export class AppBarComponent {
  @Input() appTitle = 'Application';
  @Input() logoSrc = '';
  @Input() logoAlt = 'App Logo';
  @Input() showThemeToggle = true;
  @Input() useTile = false; // Use tile for landing pages, card for full apps
  @Input() menuIcon = '☰'; // Menu button icon/text
  @Output() menuToggle = new EventEmitter<void>();

  onMenuClick() {
    this.menuToggle.emit();
  }
}
