import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

interface Spot {
  left: number;
  top: number;
  size: number;
  index: number;
}

/**
 * Canopy dapple — sunlight through leaves: soft light pools that drift and
 * swell, under slowly swaying leaf shadows. Suits canopy, soft, soft-touch.
 */
@Component({
  selector: 'otui-canopy-dapple',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './canopy-dapple.component.html',
  styleUrl: './canopy-dapple.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanopyDappleComponent {
  @Input() height = '20rem';
  @Input() density = 5;
  @Input() speed = 1;
  @Input() intensity = 0.7;
  @Input() reducedMotion = false;

  protected get spots(): Spot[] {
    const count = Math.min(Math.max(Math.round(this.density), 3), 8);
    return Array.from({ length: count }, (_, index) => ({
      left: (index * 37 + 11) % 92,
      top: (index * 53 + 17) % 84,
      size: 10 + ((index * 3) % 6),
      index,
    }));
  }

  protected readonly leaves = [0, 1, 2, 3, 4, 5, 6, 7].map((index) => ({
    index,
    left: 4 + ((index * 23) % 90),
    top: 6 + ((index * 37) % 80),
  }));
}
