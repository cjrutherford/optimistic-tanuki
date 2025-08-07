import { CommonModule } from "@angular/common";
import { Component, forwardRef, Input, Output, EventEmitter } from "@angular/core";
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from "@angular/forms";
import { Themeable, ThemeColors } from "@optimistic-tanuki/theme-ui";

/**
 * A reusable text area component with theming capabilities.
 */
@Component({
  selector: 'lib-text-area',
  standalone: true,
  imports: [CommonModule, FormsModule, FormsModule],
  templateUrl: './text-area.component.html',
  styleUrls: ['./text-area.component.scss'],
  host: {
    'class.theme': 'theme',
    '[style.--background]': 'background',
    '[style.--background-gradient]': 'backgroundGradient',
    '[style.--foreground]': 'foreground',
    '[style.--accent]': 'accent',
    '[style.--complement]': 'complement',
    '[style.--border-color]': 'borderColor',
    '[style.--border-gradient]': 'borderGradient',
    '[style.--transition-duration]': 'transitionDuration',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextAreaComponent),
      multi: true,
    },
  ],
})
export class TextAreaComponent
  extends Themeable
  implements ControlValueAccessor
{
  /**
   * The background gradient of the text area.
   */
  backgroundGradient?: string;
  /**
   * Applies the given theme colors to the component's styles.
   * @param colors The theme colors to apply.
   */
  override applyTheme(colors: ThemeColors): void {
    const accentLight = colors.accentShades?.[1][1] ?? colors.accent;
    this.background = colors.background;
    this.backgroundGradient = `linear-gradient(to bottom, ${colors.accent}, ${colors.background}, ${colors.background}, ${accentLight})`;
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.complement = colors.complementary;
    if (this.theme === 'dark') {
      this.borderGradient = colors.accentGradients['dark'];
      this.borderColor = colors.complementaryShades[2][1];
    } else {
      this.borderGradient = colors.accentGradients['light'];
      this.borderColor = colors.complementaryShades[2][1];
    }
  }
  /**
   * The label for the text area.
   */
  @Input() label = '';
  /**
   * Emits when the value of the text area changes.
   */
  @Output() valueChange = new EventEmitter<string>();

  /**
   * The current value of the text area.
   */
  value = '';
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onChange?: (value: string) => void = () => {};
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onTouched?: () => void = () => {};

  /**
   * Handles the input event of the text area.
   * @param event The input event.
   */
  onInput(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.value = input.value;
    if (this.onChange === undefined) return;
    this.onChange(this.value);
    this.valueChange.emit(this.value);
  }

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
