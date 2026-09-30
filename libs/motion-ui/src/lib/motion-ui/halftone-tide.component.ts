import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Halftone tide — two misregistered dot screens (primary + tertiary ink)
 * revealed by a slow travelling wave, like a risograph pass rolling across
 * the page. Suits risograph, bold, playful.
 *
 * Personality: speed/intensity follow the scene contract (--scene-tempo,
 * --scene-energy); colours are the theme's inks.
 */
@Component({
  selector: 'otui-halftone-tide',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './halftone-tide.component.html',
  styleUrl: './halftone-tide.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HalftoneTideComponent {
  @Input() height = '20rem';
  @Input() density = 5;
  @Input() speed = 1;
  @Input() intensity = 0.7;
  @Input() reducedMotion = false;

  /** Dot pitch in px: denser screens at higher density. */
  protected get dotStep(): string {
    const density = Math.min(Math.max(Math.round(this.density), 1), 10);
    return `${18 - density}px`;
  }
}
