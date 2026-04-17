import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

type FogBlob = {
  delay: string;
  duration: string;
  left: string;
  size: string;
  top: string;
};

@Component({
  selector: 'otui-glass-fog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './glass-fog.component.html',
  styleUrl: './glass-fog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlassFogComponent {
  @Input() height = '24rem';
  @Input() density = 4;
  @Input() speed = 1;
  @Input() intensity = 0.66;
  @Input() reducedMotion = false;

  protected get blobs(): FogBlob[] {
    const count = Math.min(Math.max(Math.round(this.density), 3), 7);

    return Array.from({ length: count }, (_, index) => {
      const left = 14 + ((index * 23) % 68);
      const top = 10 + ((index * 17) % 58);
      const size = 10 + ((index * 7) % 5) * 2.4;

      return {
        left: `${left}%`,
        top: `${top}%`,
        size: `${size.toFixed(2)}rem`,
        delay: `${(-0.5 * (index % 5)).toFixed(2)}s`,
        duration: `${(10 + ((index * 5) % 6) / Math.max(this.speed, 0.25)).toFixed(2)}s`,
      };
    });
  }
}
