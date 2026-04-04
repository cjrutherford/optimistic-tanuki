import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'otui-aurora-ribbon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './aurora-ribbon.component.html',
  styleUrl: './aurora-ribbon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuroraRibbonComponent {
  @Input() height = '24rem';
  @Input() density = 3;
  @Input() speed = 1;
  @Input() intensity = 0.72;
  @Input() reducedMotion = false;

  protected get layers(): number[] {
    const count = Math.min(Math.max(Math.round(this.density), 1), 6);
    return Array.from({ length: count }, (_, index) => index);
  }
}
