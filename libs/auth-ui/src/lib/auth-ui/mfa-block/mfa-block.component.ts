import { Component, EventEmitter, Input, Output, inject } from '@angular/core';

import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'lib-mfa-block',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TextInputComponent,
    ButtonComponent,
    CardComponent,
  ],
  templateUrl: './mfa-block.component.html',
  styleUrls: ['./mfa-block.component.scss'],
})
export class MfaBlockComponent {
  private fb = inject(FormBuilder);

  mfaForm: FormGroup;
  @Input() onboarding = false;
  @Input() qrCodeUrl = '';
  @Output() submitMfa = new EventEmitter<string>();

  constructor() {
    this.mfaForm = this.fb.group({
      token: [''],
    });
  }

  onSubmit() {
    const token = this.mfaForm.value.token;
    // Logic to handle the MFA token submission
    console.log('MFA Token Submitted:', token);
  }
}
