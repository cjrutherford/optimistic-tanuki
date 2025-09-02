import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GridComponent, HeadingComponent, TileComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'dh-benefits',
  imports: [CommonModule, HeadingComponent, TileComponent, GridComponent],
  templateUrl: './benefits.component.html',
  styleUrl: './benefits.component.scss',
})
export class BenefitsComponent {}
