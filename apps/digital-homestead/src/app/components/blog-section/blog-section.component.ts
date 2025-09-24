import { Component } from '@angular/core';

import { CardComponent, GridComponent, HeadingComponent, TileComponent } from '@optimistic-tanuki/common-ui';
import { BlogPostCardComponent } from '@optimistic-tanuki/blogging-ui';

@Component({
  selector: 'dh-blog-section',
  imports: [HeadingComponent, TileComponent, BlogPostCardComponent],
  templateUrl: './blog-section.component.html',
  styleUrl: './blog-section.component.scss',
})
export class BlogSectionComponent {}
