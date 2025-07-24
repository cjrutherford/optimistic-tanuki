import { Component, EventEmitter, Input, Output } from '@angular/core';

import { CommonModule } from '@angular/common';
import { TileComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'lib-summary-block',
  imports: [CommonModule, TileComponent],
  templateUrl: './summary-block.component.html',
  styleUrl: './summary-block.component.scss',
})
export class SummaryBlockComponent {
  @Input() title = 'Summary Block';
  @Input() count = 0;
  @Output() onClick: EventEmitter<void> = new EventEmitter<void>();
}
