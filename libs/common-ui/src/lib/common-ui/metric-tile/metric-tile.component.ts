import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type MetricDeltaDirection = 'up' | 'down' | 'flat';
export type MetricTone = 'neutral' | 'positive' | 'negative';

/**
 * Themed metric tile: label / value / optional delta + sparkline slot.
 *
 * All colors derive from semantic theme tokens. Use `deltaDirection` to drive
 * the delta color via `--success` / `--danger` / `--muted-foreground` rather
 * than passing tone directly.
 */
@Component({
  selector: 'otui-metric-tile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './metric-tile.component.html',
  styleUrls: ['./metric-tile.component.scss'],
})
export class MetricTileComponent {
  @Input() label = '';
  @Input() value: string | number = '';
  /** Short caption shown below the label (e.g. "vs last week"). */
  @Input() caption?: string;
  /** Pre-formatted delta string (e.g. "+12.4%"). */
  @Input() delta?: string;
  @Input() deltaDirection: MetricDeltaDirection = 'flat';
  /** Override delta tone explicitly when direction does not map to good/bad. */
  @Input() deltaTone?: MetricTone;

  get resolvedTone(): MetricTone {
    if (this.deltaTone) return this.deltaTone;
    if (this.deltaDirection === 'up') return 'positive';
    if (this.deltaDirection === 'down') return 'negative';
    return 'neutral';
  }
}
