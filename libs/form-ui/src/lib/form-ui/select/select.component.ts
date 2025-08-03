import {
  Component,
  forwardRef,
  Input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-ui';

@Component({
  selector: 'lib-select',
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
  templateUrl: './select.component.html',
  styleUrl: './select.component.scss',
  standalone: true,
  host: {
    '[style.--background]': 'background',
    '[style.--foreground]': 'foreground',
    '[style.--accent]': 'accent',
    '[style.--complement]': 'complement',
    '[style.--border-color]': 'borderColor',
    '[style.--border-gradient]': 'borderGradient',
    '[style.--transition-duration]': 'transitionDuration',
  },
})
export class SelectComponent extends Themeable implements ControlValueAccessor {
  @Input() options: Array<{ value: string; label: string }> = [
    { value: '', label: 'Please select' },
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ];

  override applyTheme(colors: ThemeColors): void {
    this.background = `linear-gradient(to bottom, ${colors.background}, ${colors.accent})`;
    this.accent = colors.accent;
    this.foreground = colors.foreground;
    this.borderColor = colors.complementary;
    this.complement = colors.complementary;
    if (this.theme === 'dark') {
      this.borderColor = colors.complementaryShades[6][1];
    } else {
      this.borderColor = colors.complementaryShades[2][1];
    }
  }

  value = '';
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onChange: (value: string) => void = () => {};
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onTouched: () => void = () => {};

  // ControlValueAccessor methods
  writeValue(value: string): void {
    this.value = value;
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
}
