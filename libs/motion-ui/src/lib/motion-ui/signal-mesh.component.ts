import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

type SignalNode = {
  delay: string;
  duration: string;
  left: string;
  top: string;
};

@Component({
  selector: 'otui-signal-mesh',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './signal-mesh.component.html',
  styleUrl: './signal-mesh.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignalMeshComponent {
  @Input() height = '24rem';
  @Input() density = 5;
  @Input() speed = 1;
  @Input() intensity = 0.68;
  @Input() reducedMotion = false;

  protected get columns(): number[] {
    const count = Math.min(Math.max(Math.round(this.density), 3), 7);
    return Array.from({ length: count }, (_, index) => index);
  }

  protected get rows(): number[] {
    const count = Math.min(Math.max(Math.round(this.density) + 1, 4), 8);
    return Array.from({ length: count }, (_, index) => index);
  }

  protected get verticalLines(): string[] {
    const count = this.columns.length;

    return this.columns.map(
      (column) => `${(12 + (column * 76) / Math.max(count - 1, 1)).toFixed(2)}%`
    );
  }

  protected get horizontalLines(): string[] {
    const count = this.rows.length;

    return this.rows.map(
      (row) => `${(14 + (row * 68) / Math.max(count - 1, 1)).toFixed(2)}%`
    );
  }

  protected get nodes(): SignalNode[] {
    const columns = this.columns.length;
    const rows = this.rows.length;

    return Array.from({ length: columns * rows }, (_, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const left = 12 + column * (76 / Math.max(columns - 1, 1));
      const top = 14 + row * (68 / Math.max(rows - 1, 1));

      return {
        left: `${left.toFixed(2)}%`,
        top: `${top.toFixed(2)}%`,
        delay: `${(-0.4 * ((column + row) % 6)).toFixed(2)}s`,
        duration: `${(4.6 + ((column * 3 + row * 2) % 5) / Math.max(this.speed, 0.25)).toFixed(2)}s`,
      };
    });
  }
}
