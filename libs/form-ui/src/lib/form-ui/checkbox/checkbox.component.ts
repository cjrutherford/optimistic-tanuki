import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-ui';

@Component({
  selector: 'lib-checkbox',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './checkbox.component.html',
  styleUrls: ['./checkbox.component.scss'],
  host: {
    "[style.--background]": 'background',
    "[style.--foreground]": 'foreground',
    "[style.--accent]": 'accent',
    "[style.--complement]": 'complement',
    "[style.--border-color]": 'borderColor',
    "[style.--border-gradient]": 'borderGradient',
    "[style.--transition-duration]": 'transitionDuration',
  }
})
export class CheckboxComponent extends Themeable {
  @Input() value = false;
  @Output() changeEvent: EventEmitter<boolean> = new EventEmitter<boolean>();

  onCheckboxChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.value = input.checked;
    this.changeEvent.emit(this.value);
  }

  override applyTheme(colors: ThemeColors): void {;
    this.background = `linear-gradient(to bottom, ${colors.background}, ${colors.accent})`;
    this.accent = colors.accent;
    this.foreground = colors.foreground;
    this.borderColor = colors.complementary;
    this.complement = colors.complementary;
    if (this.theme === 'dark') {
      this.borderColor = colors.complementaryShades[6][1];
      this.borderGradient = colors.complementaryGradients['dark'];
    } else {
      this.borderColor = colors.complementaryShades[2][1];
      this.borderGradient = colors.accentGradients['light'];
    }
    this.transitionDuration = '0.3s';

      
  }
}
