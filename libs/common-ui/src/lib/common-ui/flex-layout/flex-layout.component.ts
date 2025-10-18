import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'otui-flex-layout',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './flex-layout.component.html',
  styleUrls: ['./flex-layout.component.scss'],
})
export class FlexLayoutComponent {
  @Input() direction: 'row' | 'column' = 'row';
  @Input() gap = '1rem';
  @Input() align = 'stretch';
  @Input() justify = 'flex-start';
}
