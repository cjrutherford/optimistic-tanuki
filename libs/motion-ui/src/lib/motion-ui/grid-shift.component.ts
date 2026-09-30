import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

interface Block {
  start: number;
  span: number;
  row: number;
  shift: number;
  tone: 'a' | 'b' | 'c';
}

/**
 * Grid shift — the International Typographic Style in motion: a visible
 * 12-column grid with solid colour blocks that hold, then slide decisively
 * to a new column and hold again. Suits kunsthalle, architect.
 */
@Component({
  selector: 'otui-grid-shift',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './grid-shift.component.html',
  styleUrl: './grid-shift.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridShiftComponent {
  @Input() height = '20rem';
  @Input() density = 5;
  @Input() speed = 1;
  @Input() intensity = 0.7;
  @Input() reducedMotion = false;

  protected get blocks(): Block[] {
    const count = Math.min(Math.max(Math.round(this.density), 3), 7);
    const tones: Block['tone'][] = ['a', 'b', 'c'];
    return Array.from({ length: count }, (_, index) => {
      const span = 2 + ((index * 5) % 4);
      const start = (index * 7) % (12 - span);
      const room = 12 - span - start;
      const shift =
        room > 2 ? Math.min(room, 3 + (index % 3)) : -Math.min(start, 3);
      return {
        start,
        span,
        row: index,
        shift,
        tone: tones[index % tones.length],
      };
    });
  }
}
