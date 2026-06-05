import { Component } from '@angular/core';

import { HeadingComponent, TileComponent } from '@optimistic-tanuki/common-ui';
import { BlogPostCardComponent } from '@optimistic-tanuki/blogging-ui';
import { SERVICE_ENTRIES } from '../services.data';

@Component({
  selector: 'app-services-grid',
  imports: [TileComponent, HeadingComponent, BlogPostCardComponent],
  templateUrl: './services-grid.component.html',
  styleUrl: './services-grid.component.scss',
})
export class ServicesGridComponent {
  readonly services = SERVICE_ENTRIES;

  linkTo(url: string): void {
    window.location.href = url;
  }
}
