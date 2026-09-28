import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

interface Trace {
  d: string;
  end: [number, number];
  index: number;
}

/**
 * Deterministic orthogonal traces on a 120x80 board: each starts on an edge
 * and takes a few right-angle turns (a seeded LCG keeps SSR and the browser
 * identical).
 */
function traces(count: number): Trace[] {
  const out: Trace[] = [];
  let seed = 1013;
  const next = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  for (let index = 0; index < count; index++) {
    let x = index % 2 === 0 ? 0 : 10 + Math.round(next() * 10) * 10;
    let y = index % 2 === 0 ? 8 + Math.round(next() * 6) * 10 : 0;
    const points: [number, number][] = [[x, y]];
    let horizontal = index % 2 === 0;
    for (let turn = 0; turn < 4; turn++) {
      const step = (2 + Math.round(next() * 3)) * 10;
      if (horizontal) x = Math.min(120, x + step);
      else y = Math.min(80, y + step);
      points.push([x, y]);
      horizontal = !horizontal;
    }
    out.push({
      d: 'M' + points.map(([px, py]) => `${px} ${py}`).join(' L'),
      end: points[points.length - 1],
      index,
    });
  }
  return out;
}

/**
 * Neon circuit — a dim circuit board whose traces carry travelling pulses of
 * light to glowing nodes. Suits electric, control-center.
 */
@Component({
  selector: 'otui-neon-circuit',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './neon-circuit.component.html',
  styleUrl: './neon-circuit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NeonCircuitComponent {
  @Input() height = '20rem';
  @Input() density = 5;
  @Input() speed = 1;
  @Input() intensity = 0.7;
  @Input() reducedMotion = false;

  protected get traces(): Trace[] {
    return traces(Math.min(Math.max(Math.round(this.density) + 3, 4), 12));
  }
}
