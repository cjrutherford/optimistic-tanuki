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
export class SelectComponent extends Themeable implements ControlValueAccessor {
  @Input() options: Array<{ value: string; label: string }> = [
    { value: '', label: 'Please select' },
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ];

  override applyTheme(colors: ThemeColors): void {
    // Use standardized color assignments with design tokens
    this.background = `linear-gradient(to bottom, ${colors.background}, ${colors.accent})`;
    this.accent = colors.accent;
    this.foreground = colors.foreground;
    this.borderColor = colors.complementary;
    this.complement = colors.complementary;
    this.transitionDuration = '0.15s'; // Use standardized duration
    
    // Use numbered shades instead of hardcoded shade access
    if (this.theme === 'dark') {
      this.borderColor = colors.complementaryShades[6][1]; // Darker shade
    } else {
      this.borderColor = colors.complementaryShades[2][1]; // Lighter shade
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
