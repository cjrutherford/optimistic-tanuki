import { Component } from '@angular/core';

import { HeadingComponent, TileComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'dh-about',
  imports: [HeadingComponent, TileComponent],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {}
