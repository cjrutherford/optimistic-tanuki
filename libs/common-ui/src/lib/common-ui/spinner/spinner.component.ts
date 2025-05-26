import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-ui';

@Component({
  selector: 'otui-spinner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './spinner.component.html',
  host: { '[style.--accent]': 'accent' },
  styleUrls: ['./spinner.component.scss'],
})
export class SpinnerComponent extends Themeable {
  override applyTheme(colors: ThemeColors): void {
    this.accent = colors.accent;
  }
  @Input() styleType: 'default' | 'circle' | 'dots'| 'dual-ring' | 'hourglass' = 'default';
}
