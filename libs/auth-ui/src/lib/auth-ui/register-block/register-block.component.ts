import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';
import {
  Themeable,
  ThemeColors,
  ThemeService,
} from '@optimistic-tanuki/theme-lib';
import { RegisterSubmitType } from '@optimistic-tanuki/ui-models';
import {
  OAuthButtonsComponent,
  OAuthProviderEvent,
} from '../oauth-buttons/oauth-buttons.component';

@Component({
  selector: 'lib-register-block',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardComponent,
    ButtonComponent,
    TextInputComponent,
    OAuthButtonsComponent,
  ],
  templateUrl: './register-block.component.html',
  styleUrls: ['./register-block.component.scss'],
  host: {
    // Using standardized local variables with fallbacks
    '[style.--local-background]': 'background',
    '[style.--local-foreground]': 'foreground',
    '[style.--local-accent]': 'accent',
    '[style.--local-complement]': 'complement',
    '[style.--local-border-color]': 'borderColor',
    '[style.--local-transition-duration]': 'transitionDuration',
  },
})
export class RegisterBlockComponent extends Themeable {
  @Input() ageGateEnabled = false;
  @Input() guardianResumeToken = '';
  @Input() registerHeader = 'Register';
  @Input() registerButtonText = 'Register';
  @Input() callToAction = 'Join us on your journey';
  @Input() heroSource =
    'https://source.unsplash.com/random/800x600/?nature,water';
  // Hosts that render their own marketing column suppress the in-card hero so
  // the page does not end up with two headlines competing for the same job.
  @Input() showHero = true;
  @Input() errorMessage = '';
  @Input() pending = false;
  @Input() showOAuth = true;
  @Input() enabledOAuthProviders: string[] = [
    'google',
    'github',
    'microsoft',
    'facebook',
  ];
  @Output() submitEvent = new EventEmitter<RegisterSubmitType>();
  @Output() oauthProviderSelected = new EventEmitter<OAuthProviderEvent>();
  registerForm: FormGroup;
  registrationStep: 'age' | 'adult' | 'guardian' | 'blocked' = 'age';
  constructor(private readonly fb: FormBuilder) {
    super();
    this.registerForm = this.fb.group({
      firstName: this.fb.control(''),
      lastName: this.fb.control(''),
      email: this.fb.control(''),
      password: this.fb.control(''),
      confirmation: this.fb.control(''),
      bio: this.fb.control(''),
      dateOfBirth: this.fb.control(''),
      guardianEmail: this.fb.control(''),
    });
  }

  ngOnChanges(): void {
    if (this.guardianResumeToken) {
      this.registrationStep = 'adult';
    }
  }

  continueFromAge(): void {
    const value = this.registerForm.get('dateOfBirth')?.value;
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const dob = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(dob.getTime()) || dob.toISOString().slice(0, 10) !== value) return;
    const today = new Date();
    let age = today.getUTCFullYear() - dob.getUTCFullYear();
    const beforeBirthday =
      today.getUTCMonth() < dob.getUTCMonth() ||
      (today.getUTCMonth() === dob.getUTCMonth() && today.getUTCDate() < dob.getUTCDate());
    if (beforeBirthday) age -= 1;
    if (age < 13) {
      this.registrationStep = 'blocked';
      return;
    }
    this.registrationStep = age < 18 ? 'guardian' : 'adult';
  }

  override applyTheme(colors: ThemeColors): void {
    // Use standardized color assignments with design tokens
    this.background = `linear-gradient(30deg, ${colors.accent}, ${colors.background})`;
    this.accent = colors.accent;
    this.borderColor = colors.complementary;

    // Use standardized gradient names
    if (this.theme === 'dark') {
      this.borderGradient = colors.complementaryGradients['dark'];
    } else {
      this.borderGradient = colors.complementaryGradients['light'];
    }

    this.foreground = colors.foreground;
    this.complement = colors.complementary;
    this.transitionDuration = '0.15s'; // Use standardized duration
  }

  onFormChange(e: string) {
    console.log(e);
  }

  onSubmit() {
    const { dateOfBirth, guardianEmail, ...accountFields } =
      this.registerForm.value;
    this.submitEvent.emit({
      ...accountFields,
      ...(this.ageGateEnabled
        ? {
            dateOfBirth,
            guardianResumeToken: this.guardianResumeToken || undefined,
          }
        : {}),
    });
  }

  requestGuardianPermission(): void {
    this.submitEvent.emit({
      dateOfBirth: this.registerForm.value.dateOfBirth,
      email: this.registerForm.value.email,
      guardianEmail: this.registerForm.value.guardianEmail,
      guardianConsentRequest: true,
    } as RegisterSubmitType);
  }

  onOAuthProvider(event: OAuthProviderEvent) {
    this.oauthProviderSelected.emit({
      ...event,
      ...(this.ageGateEnabled
        ? {
            dateOfBirth: this.registerForm.value.dateOfBirth || undefined,
            guardianResumeToken: this.guardianResumeToken || undefined,
          }
        : {}),
    });
  }
}
