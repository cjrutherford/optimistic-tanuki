import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent, CardComponent, GridComponent, HeadingComponent, TileComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'app-services-grid',
  imports: [CommonModule, GridComponent, TileComponent, HeadingComponent, CardComponent, ButtonComponent],
  templateUrl: './services-grid.component.html',
  styleUrl: './services-grid.component.scss',
})
export class ServicesGridComponent {}
