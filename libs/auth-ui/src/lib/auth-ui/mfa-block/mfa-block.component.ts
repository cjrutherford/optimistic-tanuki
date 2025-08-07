import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'lib-mfa-block',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TextInputComponent, ButtonComponent, CardComponent],
  templateUrl: './mfa-block.component.html',
  styleUrls: ['./mfa-block.component.scss'],
})
/**
 * Component for handling Multi-Factor Authentication (MFA).
 */
export class MfaBlockComponent {
  /**
   * The MFA form group.
   */
  mfaForm: FormGroup;
  /**
   * Indicates whether the MFA block is in onboarding mode.
   */
  @Input() onboarding = false;
  /**
   * The URL of the QR code for MFA setup.
   */
  @Input() qrCodeUrl = '';
  /**
   * Emits the submitted MFA token.
   */
  @Output() submitMfa = new EventEmitter<string>();

  /**
   * Creates an instance of MfaBlockComponent.
   * @param fb The FormBuilder instance.
   */
  constructor(private fb: FormBuilder) {
    this.mfaForm = this.fb.group({
      token: ['']
    });
  }

  /**
   * Handles the MFA form submission.
   */
  onSubmit() {
    const token = this.mfaForm.value.token;
    // Logic to handle the MFA token submission
    console.log('MFA Token Submitted:', token);
  }
}
