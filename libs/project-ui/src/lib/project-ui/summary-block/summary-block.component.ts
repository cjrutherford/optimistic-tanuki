import { Component, EventEmitter, Input, Output } from '@angular/core';


import { TileComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'lib-summary-block',
  imports: [TileComponent],
  templateUrl: './summary-block.component.html',
  styleUrl: './summary-block.component.scss',
})
export class SummaryBlockComponent {
  @Input() title = 'Summary Block';
  @Input() count = 0;
  @Output() onClick: EventEmitter<void> = new EventEmitter<void>();
}
