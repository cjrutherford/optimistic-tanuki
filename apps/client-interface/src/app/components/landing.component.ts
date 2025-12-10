import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

import {
  CardComponent,
  GridComponent,
  HeadingComponent,
  ListComponent,
  TileComponent,
} from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    GridComponent,
    HeadingComponent,
    ListComponent,
    TileComponent,
  ],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent {
  featureItems: string[] = [
    'Light/Dark Mode',
    'Custom Accent/Complement Colors',
    'Rich text editing for: Posts, comments, and responses.',
  ];
}
