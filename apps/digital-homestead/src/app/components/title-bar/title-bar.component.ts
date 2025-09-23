import { Component, signal } from '@angular/core';

import { ButtonComponent, HeadingComponent, TileComponent } from '@optimistic-tanuki/common-ui'

@Component({
  selector: 'dh-title-bar',
  imports: [HeadingComponent, TileComponent, ButtonComponent],
  templateUrl: './title-bar.component.html',
  styleUrl: './title-bar.component.scss',
})
export class TitleBarComponent {
  menuOpen = signal(false);

  toggleMenu() {
    this.menuOpen.set(!this.menuOpen());
  }
}
