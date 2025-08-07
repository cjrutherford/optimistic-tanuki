import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, GridComponent, HeadingComponent, ListComponent, TileComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    CommonModule, 
    GridComponent, 
    TileComponent, 
    HeadingComponent,
    CardComponent,
    ListComponent,
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
/**
 * Component for the landing page of the application.
 */
export class LandingComponent {
  /**
   * List of features to display on the landing page.
   */
  featureItems: string[]= [
    'Light/Dark Mode',
    'Custom Accent/Complement Colors',
    'Multiple profiles by default',
    "Rich text editing for: Posts, comments, and responses.",
  ]
}
