import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, GridComponent, HeadingComponent, TileComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'dh-blog-section',
  imports: [CommonModule, HeadingComponent, CardComponent, TileComponent, GridComponent],
  templateUrl: './blog-section.component.html',
  styleUrl: './blog-section.component.scss',
})
export class BlogSectionComponent {}
