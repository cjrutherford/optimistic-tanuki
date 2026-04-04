import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

type ParticleModel = {
  delay: string;
  driftX: string;
  driftY: string;
  duration: string;
  left: string;
  opacity: number;
  size: string;
  top: string;
};

@Component({
  selector: 'otui-particle-veil',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './particle-veil.component.html',
  styleUrl: './particle-veil.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParticleVeilComponent {
  @Input() height = '24rem';
  @Input() density = 24;
  @Input() speed = 1;
  @Input() intensity = 0.6;
  @Input() reducedMotion = false;

  protected get particles(): ParticleModel[] {
    const count = Math.min(Math.max(Math.round(this.density), 6), 48);

    return Array.from({ length: count }, (_, index) => {
      const x = (index * 37) % 100;
      const y = (index * 19) % 100;
      const size = 0.25 + ((index * 7) % 6) * 0.08;
      const opacity = 0.22 + ((index * 11) % 5) * 0.08;
      const delay = -((index % 9) * 0.55);
      const duration = 7 + ((index * 5) % 6) / Math.max(this.speed, 0.2);
      const driftX = -12 + ((index * 13) % 25);
      const driftY = -18 - ((index * 9) % 24);

      return {
        left: `${x}%`,
        top: `${y}%`,
        size: `${size.toFixed(2)}rem`,
        opacity,
        delay: `${delay.toFixed(2)}s`,
        duration: `${duration.toFixed(2)}s`,
        driftX: `${driftX.toFixed(2)}%`,
        driftY: `${driftY.toFixed(2)}%`,
      };
    });
  }
}
