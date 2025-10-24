import { Component, Input } from '@angular/core';


@Component({
  selector: 'lib-ai-summary',
  imports: [],
  templateUrl: './ai-summary.component.html',
  styleUrl: './ai-summary.component.scss',
})
export class AiSummaryComponent {
  @Input() summaryText = '';
}
