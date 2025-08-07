import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-ai-summary',
  imports: [CommonModule],
  templateUrl: './ai-summary.component.html',
  styleUrl: './ai-summary.component.scss',
})
/**
 * Component for displaying AI-generated summaries.
 */
export class AiSummaryComponent {
  /**
   * The text content of the summary.
   */
  @Input() summaryText = '';
}
