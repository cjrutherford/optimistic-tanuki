import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeadingComponent, TileComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'dh-resources',
  imports: [CommonModule, HeadingComponent, TileComponent],
  templateUrl: './resources.component.html',
  styleUrl: './resources.component.scss',
})
export class ResourcesComponent {}
