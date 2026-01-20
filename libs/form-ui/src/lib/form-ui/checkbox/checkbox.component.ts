import { Component, EventEmitter, Input, Output, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'lib-checkbox',
  standalone: true,
  imports: [],
  templateUrl: './checkbox.component.html',
  styleUrls: ['./checkbox.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxComponent),
      multi: true,
    },
  ],
  host: {
    // Using standardized local variables with fallbacks
    '[style.--local-background]': 'background',
    '[style.--local-foreground]': 'foreground',
    '[style.--local-accent]': 'accent',
    '[style.--local-complement]': 'complement',
    '[style.--local-border-color]': 'borderColor',
    '[style.--local-border-gradient]': 'borderGradient',
    '[style.--local-transition-duration]': 'transitionDuration',
  },
})
export class CheckboxComponent extends Themeable implements ControlValueAccessor {
  @Input() value = false;
  @Input() label = '';
  @Output() changeEvent: EventEmitter<boolean> = new EventEmitter<boolean>();

  onChange: any = () => {};
  onTouched: any = () => {};

  onCheckboxChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.value = input.checked;
    this.onChange(this.value);
    this.changeEvent.emit(this.value);
  }

  override applyTheme(colors: ThemeColors): void {
    // Use standardized color assignments with design tokens
    this.background = `linear-gradient(to bottom, ${colors.background}, ${colors.accent})`;
    this.accent = colors.accent;
    this.foreground = colors.foreground;
    this.borderColor = colors.complementary;
    this.complement = colors.complementary;
    this.transitionDuration = '0.15s'; // Use standardized duration

    // Use numbered shades and standardized gradient names
    if (this.theme === 'dark') {
      this.borderColor = colors.complementaryShades[6][1];
      this.borderGradient = colors.complementaryGradients['dark'];
    } else {
      this.borderColor = colors.complementaryShades[2][1];
      this.borderGradient = colors.accentGradients['light'];
    }
  }

  // ControlValueAccessor implementation
  writeValue(value: any): void {
    this.value = !!value;
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    // Implement if needed
  }
}
