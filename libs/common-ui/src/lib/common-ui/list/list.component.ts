
import { Component, Input } from '@angular/core';

@Component({
  selector: 'otui-list',
  standalone: true,
  imports: [],
  template: `
    <ul [class]="type">
      @for (item of items; track item) {
        <li>{{ item }}</li>
      }
    </ul>
    `,
  styleUrls: ['./list.component.scss']
})
export class ListComponent {
  @Input() items: string[] = [];
  @Input() type: 'bullet' | 'number' | 'dash' | 'block-list' = 'bullet';
}
