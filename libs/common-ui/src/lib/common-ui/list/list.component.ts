import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'otui-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ul [class]="type">
      <li *ngFor="let item of items">{{ item }}</li>
    </ul>
  `,
  styleUrls: ['./list.component.scss']
})
export class ListComponent {
  @Input() items: string[] = [];
  @Input() type: 'bullet' | 'number' | 'dash' | 'block-list' = 'bullet';
}
