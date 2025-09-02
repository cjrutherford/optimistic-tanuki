import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'otui-heading',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="heading" [ngStyle]="{'font-size': size, 'color': color}">{{ text }}</span>
  `,
  styleUrls: ['./heading.component.scss']
})
export class HeadingComponent {
  @Input() text = '';
  @Input() size = '1em';
  @Input() color = '#fff';
}
