import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

interface Figure {
  text: string;
  negative: boolean;
}

/** Deterministic figures so SSR and the browser render the same frame. */
function figuresFor(column: number, rows: number): Figure[] {
  const out: Figure[] = [];
  let seed = 7919 * (column + 1);
  for (let row = 0; row < rows; row++) {
    seed = (seed * 48271) % 2147483647;
    const value = (seed % 9_000_000) / 100 + 10;
    const negative = seed % 5 === 0;
    const text = value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    out.push({ text: negative ? `(${text})` : text, negative });
  }
  return out;
}

/**
 * Ledger ticker — ruled journal paper with columns of tabular figures
 * drifting slowly upward; negatives in the second ink, a double rule for the
 * totals line. Suits ledger, professional, control-center.
 */
@Component({
  selector: 'otui-ledger-ticker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ledger-ticker.component.html',
  styleUrl: './ledger-ticker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LedgerTickerComponent {
  @Input() height = '20rem';
  @Input() density = 5;
  @Input() speed = 1;
  @Input() intensity = 0.7;
  @Input() reducedMotion = false;

  /** Each column's figures are listed twice so the scroll loops seamlessly. */
  protected get columns(): Figure[][] {
    const count = Math.min(Math.max(Math.round(this.density), 3), 8);
    return Array.from({ length: count }, (_, column) => {
      const figures = figuresFor(column, 14);
      return [...figures, ...figures];
    });
  }
}
