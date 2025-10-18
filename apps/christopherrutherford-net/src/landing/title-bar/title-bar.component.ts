import { Component, signal } from '@angular/core';

import { CardComponent, HeadingComponent, ButtonComponent, ModalComponent, TileComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'dh-title-bar',
  imports: [HeadingComponent, CardComponent, ButtonComponent, ModalComponent, TileComponent],
  templateUrl: './title-bar.component.html',
  styleUrl: './title-bar.component.scss',
})
export class TitleBarComponent {
  menuOpen = signal(false);

  toggleMenu() {
    this.menuOpen.set(!this.menuOpen());
  }
}
