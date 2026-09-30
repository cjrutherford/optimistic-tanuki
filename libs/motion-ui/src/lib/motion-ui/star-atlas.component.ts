import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Star atlas — a printed star chart come alive: two twinkling star fields,
 * concentric orbits with slow-travelling bodies, and a coordinate reticle.
 * Suits observatory, elegant.
 */
@Component({
  selector: 'otui-star-atlas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './star-atlas.component.html',
  styleUrl: './star-atlas.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarAtlasComponent {
  @Input() height = '20rem';
  @Input() density = 5;
  @Input() speed = 1;
  @Input() intensity = 0.7;
  @Input() reducedMotion = false;

  protected get orbits(): { index: number; phase: number }[] {
    const count = Math.min(Math.max(Math.round(this.density / 2) + 1, 2), 5);
    const phases = [0.08, 0.41, 0.73, 0.24, 0.57];
    return Array.from({ length: count }, (_, index) => ({
      index,
      phase: phases[index],
    }));
  }
}
