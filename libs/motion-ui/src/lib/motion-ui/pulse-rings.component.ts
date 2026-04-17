import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'otui-pulse-rings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pulse-rings.component.html',
  styleUrl: './pulse-rings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PulseRingsComponent {
  @Input() height = '20rem';
  @Input() ringCount = 4;
  @Input() speed = 1;
  @Input() intensity = 0.7;
  @Input() reducedMotion = false;

  protected get rings(): number[] {
    const count = Math.min(Math.max(Math.round(this.ringCount), 2), 8);
    return Array.from({ length: count }, (_, index) => index);
  }
}
