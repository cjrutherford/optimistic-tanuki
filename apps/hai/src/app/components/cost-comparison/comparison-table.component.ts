import { Component, Input } from '@angular/core';
import { ComparisonRow } from '../../content/cost-comparison';

/** Side-by-side subscription vs owned comparison, plus when subscriptions win. */
@Component({
  selector: 'hai-comparison-table',
  standalone: true,
  templateUrl: './comparison-table.component.html',
  styleUrl: './comparison-table.component.scss',
})
export class ComparisonTableComponent {
  @Input({ required: true }) rows: ComparisonRow[] = [];
  @Input({ required: true }) subscriptionBetterWhen: string[] = [];
}
