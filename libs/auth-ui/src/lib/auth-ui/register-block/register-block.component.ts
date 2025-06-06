import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';
import { Themeable, ThemeColors, ThemeService } from '@optimistic-tanuki/theme-ui';
import { RegisterSubmitType } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'lib-register-block',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CardComponent, ButtonComponent, TextInputComponent],
  templateUrl: './register-block.component.html',
  styleUrls: ['./register-block.component.scss'],
  host: { // Added host bindings
    '[style.--background]': 'background',
    '[style.--foreground]': 'foreground',
    '[style.--accent]': 'accent',
    '[style.--complement]': 'complement',
    '[style.--border-color]': 'borderColor',
    '[style.--border-gradient]': 'borderGradient',
    '[style.--transition-duration]': 'transitionDuration',
  }
})
export class RegisterBlockComponent extends Themeable {
  @Input() registerHeader = 'Register';
  @Input() registerButtonText = 'Register';
  @Input() callToAction = 'Join us on your journey';
  @Input() heroSource = 'https://source.unsplash.com/random/800x600/?nature,water'; 
  @Output() submitEvent = new EventEmitter<RegisterSubmitType>();
  registerForm: FormGroup;
  constructor(private readonly fb: FormBuilder, themeService: ThemeService) {
    super(themeService);
    this.registerForm = this.fb.group({
      firstName: this.fb.control(''),
      lastName: this.fb.control(''),
      email: this.fb.control(''),
      password: this.fb.control(''),
      confirmation: this.fb.control(''),
      bio: this.fb.control(''),
    });
  }

  override applyTheme(colors: ThemeColors): void {
    this.background = `linear-gradient(30deg, ${colors.accent}, ${colors.background})`;
    this.accent = colors.accent;
    this.borderColor = colors.complementary;
    if (this.theme === 'dark') {
      this.borderGradient = colors.complementaryGradients['dark'];
    } else {
      this.borderGradient = colors.complementaryGradients['light'];
    }
    this.foreground = colors.foreground;
    this.complement = colors.complementary;
    this.transitionDuration = '0.5s';
  }

  onFormChange(e: string) {
    console.log(e);
  }

  onSubmit() {
    this.submitEvent.emit(this.registerForm.value);
  }
}
