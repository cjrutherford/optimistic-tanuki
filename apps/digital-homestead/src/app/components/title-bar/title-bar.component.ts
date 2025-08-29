import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeadingComponent, TileComponent } from '@optimistic-tanuki/common-ui'

@Component({
  selector: 'dh-title-bar',
  imports: [CommonModule, HeadingComponent, TileComponent],
  templateUrl: './title-bar.component.html',
  styleUrl: './title-bar.component.scss',
})
export class TitleBarComponent {}
