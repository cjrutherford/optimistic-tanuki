import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'otui-shimmer-beam',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shimmer-beam.component.html',
  styleUrl: './shimmer-beam.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShimmerBeamComponent {
  @Input() height = '18rem';
  @Input() speed = 1;
  @Input() intensity = 0.65;
  @Input() reducedMotion = false;
  @Input() direction: 'diagonal' | 'horizontal' = 'diagonal';
}
