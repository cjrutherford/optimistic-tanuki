
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'otui-spinner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './spinner.component.html',
  styleUrls: ['./spinner.component.scss'],
  host: {
    '[style.--accent]': 'accent',
    '[style.--foreground]': 'foreground',
    '[style.--background]': 'background',
    '[style.--complement]': 'complement',
    '[style.--spinner-size]': 'size',
  },
})
export class SpinnerComponent extends Themeable {
  @Input() styleType: 'default' | 'circle' | 'dots'| 'dual-ring' | 'hourglass' = 'default';
  size = '32px';

  override applyTheme(colors: ThemeColors): void {
    this.setLocalCSSVariable('accent', colors.accent);
    this.setLocalCSSVariable('foreground', colors.foreground);
    this.setLocalCSSVariable('background', colors.background);
    this.setLocalCSSVariable('complement', colors.complementary);
  }
}
