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
/**
 * Component for displaying a user registration form.
 */
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
  /**
   * The header text for the registration block.
   */
  @Input() registerHeader = 'Register';
  /**
   * The text for the registration button.
   */
  @Input() registerButtonText = 'Register';
  /**
   * The call to action message.
   */
  @Input() callToAction = 'Join us on your journey';
  /**
   * The source URL for the hero image.
   */
  @Input() heroSource = 'https://source.unsplash.com/random/800x600/?nature,water'; 
  /**
   * Emits the registration form data when submitted.
   */
  @Output() submitEvent = new EventEmitter<RegisterSubmitType>();
  /**
   * The registration form group.
   */
  registerForm: FormGroup;
  /**
   * Creates an instance of RegisterBlockComponent.
   * @param fb The FormBuilder instance.
   * @param themeService The ThemeService instance.
   */
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

  /**
   * Applies the given theme colors to the component's styles.
   * @param colors The theme colors to apply.
   */
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

  /**
   * Handles changes in the form.
   * @param e The event object.
   */
  onFormChange(e: string) {
    console.log(e);
  }

  /**
   * Handles the form submission.
   */
  onSubmit() {
    this.submitEvent.emit(this.registerForm.value);
  }
}
