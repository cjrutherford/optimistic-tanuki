import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { Component, EventEmitter, Output } from '@angular/core';
import { CreateRisk, Risk } from '@optimistic-tanuki/ui-models';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SelectComponent, TextAreaComponent, TextInputComponent } from '@optimistic-tanuki/form-ui';

import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-risk-form',
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent, CardComponent, TextAreaComponent, TextInputComponent, SelectComponent],
  templateUrl: './risk-form.component.html',
  styleUrl: './risk-form.component.scss',
})
export class RiskFormComponent {
  riskForm: FormGroup;
  @Output() submitted: EventEmitter<CreateRisk> = new EventEmitter<CreateRisk>();

  constructor(private fb: FormBuilder) {
    this.riskForm = this.fb.group({
      title: [''],
      description: [''],
      impact: [''],
      likelihood: [''],
    });
  }
  impactOptions = [
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
  ];

  likelihoodOptions = [
    { value: 'UNLIKELY', label: 'Unlikely' },
    { value: 'POSSIBLE', label: 'Possible' },
    { value: 'LIKELY', label: 'Likely' },
    { value: 'IMMINENT', label: 'Imminent' },
    { value: 'ALMOST_CERTAIN', label: 'Almost Certain' },
    { value: 'CERTAIN', label: 'Certain' },
    { value: 'NOT_APPLICABLE', label: 'Not Applicable' },
    { value: 'UNKNOWN', label: 'Unknown' },
  ];

  onSubmit() {
    if (this.riskForm.valid) {
      console.log('Risk Form Submitted!', this.riskForm.value);
      this.submitted.emit(this.riskForm.value);
    }
  }
}
