import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeadingComponent, TileComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'dh-about',
  imports: [CommonModule, HeadingComponent, TileComponent],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {}
