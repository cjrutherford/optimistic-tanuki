import { Component, EventEmitter, Input, Output, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-ui';

@Component({
  selector: 'lib-text-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './text-input.component.html',
  styleUrls: ['./text-input.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextInputComponent),
      multi: true,
    },
  ],
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
export class TextInputComponent extends Themeable implements ControlValueAccessor {
  @Input() type: 'text' | 'password' | 'obscured' | 'date' = 'text';
  @Input() label = '';  
  @Input() labelPosition: 'top' | 'left' | 'right' | 'bottom' = 'top';
  @Output() valueChange = new EventEmitter<string>();

  value = '';
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onChange?:(value: string) => void = (value: string) => { /*console.log(value);*/ };
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onTouched?:(value: string) => void = () => {};

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.value = input.value;
    if( this.onChange === undefined) return;
    this.onChange(this.value);
    this.valueChange.emit(this.value);
  }

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
