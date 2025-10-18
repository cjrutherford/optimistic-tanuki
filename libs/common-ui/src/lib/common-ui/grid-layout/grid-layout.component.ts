import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'otui-grid-layout',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './grid-layout.component.html',
  styleUrls: ['./grid-layout.component.scss'],
})
export class GridLayoutComponent {
  @Input() columns = 3;
  @Input() gap = '1rem';
  @Input() minWidth = '100px';
}
