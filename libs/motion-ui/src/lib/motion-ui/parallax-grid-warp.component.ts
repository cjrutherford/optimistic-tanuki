import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

type WarpBeam = {
  delay: string;
  duration: string;
  left: string;
};

@Component({
  selector: 'otui-parallax-grid-warp',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './parallax-grid-warp.component.html',
  styleUrl: './parallax-grid-warp.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParallaxGridWarpComponent {
  @Input() height = '24rem';
  @Input() density = 6;
  @Input() speed = 1;
  @Input() intensity = 0.7;
  @Input() reducedMotion = false;

  protected get beams(): WarpBeam[] {
    const count = Math.min(Math.max(Math.round(this.density), 4), 9);

    return Array.from({ length: count }, (_, index) => ({
      left: `${(12 + index * (72 / Math.max(count - 1, 1))).toFixed(2)}%`,
      delay: `${(-0.45 * (index % 5)).toFixed(2)}s`,
      duration: `${(5.5 + ((index * 2) % 4) / Math.max(this.speed, 0.25)).toFixed(2)}s`,
    }));
  }
}
