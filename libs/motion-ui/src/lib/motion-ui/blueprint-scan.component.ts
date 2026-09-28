import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

interface Mark {
  label: string;
  left: number;
  top: number;
}

/**
 * Blueprint scan — a drafting grid swept by a slow scan line; dimension
 * marks light up as the scan passes them. Suits architect, control-center.
 */
@Component({
  selector: 'otui-blueprint-scan',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './blueprint-scan.component.html',
  styleUrl: './blueprint-scan.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlueprintScanComponent {
  @Input() height = '20rem';
  @Input() density = 5;
  @Input() speed = 1;
  @Input() intensity = 0.7;
  @Input() reducedMotion = false;

  protected get marks(): Mark[] {
    const labels = [
      '240.00',
      'R 12',
      '⌀ 36',
      '1:50',
      '88.5',
      '45°',
      'A–A',
      '12.70',
    ];
    const count = Math.min(
      Math.max(Math.round(this.density) + 2, 4),
      labels.length
    );
    return labels.slice(0, count).map((label, index) => ({
      label,
      left: 8 + ((index * 31) % 80),
      top: 10 + ((index * 23) % 78),
    }));
  }
}
