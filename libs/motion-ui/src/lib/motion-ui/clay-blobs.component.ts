import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

interface Blob {
  index: number;
  left: number;
  top: number;
  size: number;
  tone: 'primary' | 'secondary' | 'tertiary';
}

/**
 * Clay blobs — soft moulded pebbles that slowly squash, stretch and settle,
 * with a highlight on top and shade underneath. Suits clay, playful,
 * soft-touch.
 */
@Component({
  selector: 'otui-clay-blobs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './clay-blobs.component.html',
  styleUrl: './clay-blobs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClayBlobsComponent {
  @Input() height = '20rem';
  @Input() density = 5;
  @Input() speed = 1;
  @Input() intensity = 0.7;
  @Input() reducedMotion = false;

  protected get blobs(): Blob[] {
    const count = Math.min(Math.max(Math.round(this.density), 3), 6);
    const tones: Blob['tone'][] = ['primary', 'tertiary', 'secondary'];
    return Array.from({ length: count }, (_, index) => ({
      index,
      left: 10 + ((index * 29) % 78),
      top: 18 + ((index * 41) % 62),
      size: 7 + ((index * 7) % 6),
      tone: tones[index % tones.length],
    }));
  }
}
