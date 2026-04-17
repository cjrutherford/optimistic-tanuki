import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

type ContourBand = {
  delay: string;
  duration: string;
  opacity: number;
  top: string;
  width: string;
};

@Component({
  selector: 'otui-topographic-drift',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './topographic-drift.component.html',
  styleUrl: './topographic-drift.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopographicDriftComponent {
  @Input() height = '24rem';
  @Input() density = 6;
  @Input() speed = 1;
  @Input() intensity = 0.64;
  @Input() reducedMotion = false;

  protected get bands(): ContourBand[] {
    const count = Math.min(Math.max(Math.round(this.density), 4), 10);

    return Array.from({ length: count }, (_, index) => {
      const top = 14 + index * (66 / Math.max(count - 1, 1));
      const width = 72 + (index % 3) * 10;

      return {
        top: `${top.toFixed(2)}%`,
        width: `${width}%`,
        opacity: 0.24 + ((index * 2) % 5) * 0.1,
        delay: `${(-0.35 * (index % 6)).toFixed(2)}s`,
        duration: `${(8 + ((index * 3) % 5) / Math.max(this.speed, 0.25)).toFixed(2)}s`,
      };
    });
  }
}
