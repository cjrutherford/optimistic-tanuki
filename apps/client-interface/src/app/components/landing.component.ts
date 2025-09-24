import { Component } from '@angular/core';

import { CardComponent, GridComponent, HeadingComponent, ListComponent, TileComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    GridComponent,
    TileComponent,
    HeadingComponent,
    CardComponent,
    ListComponent
],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  featureItems: string[]= [
    'Light/Dark Mode',
    'Custom Accent/Complement Colors',
    'Multiple profiles by default',
    "Rich text editing for: Posts, comments, and responses.",
  ]
}
