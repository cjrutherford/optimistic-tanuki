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


/**
 * A reusable select input component with theming capabilities.
 */
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
  /**
   * The options to display in the select dropdown.
   */
  @Input() options: Array<{ value: string; label: string }> = [
    { value: '', label: 'Please select' },
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ];

  /**
   * Applies the given theme colors to the component's styles.
   * @param colors The theme colors to apply.
   */
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

  /**
   * The current value of the select input.
   */
  value = '';
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onChange: (value: string) => void = () => {};
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onTouched: () => void = () => {};

  /**
   * Writes a new value to the element.
   * @param value The new value.
   */
  writeValue(value: string): void {
    this.value = value;
  }
  /**
   * Registers a callback function that is called when the control's value changes.
   * @param fn The callback function.
   */
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  /**
   * Registers a callback function that is called when the control receives a touch event.
   * @param fn The callback function.
   */
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
}
