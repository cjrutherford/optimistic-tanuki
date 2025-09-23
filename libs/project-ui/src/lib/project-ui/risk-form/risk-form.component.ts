import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CreateRisk, Risk } from '@optimistic-tanuki/ui-models';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SelectComponent, TextAreaComponent, TextInputComponent } from '@optimistic-tanuki/form-ui';



@Component({
  selector: 'lib-risk-form',
  imports: [ReactiveFormsModule, ButtonComponent, CardComponent, TextAreaComponent, TextInputComponent, SelectComponent],
  templateUrl: './risk-form.component.html',
  styleUrl: './risk-form.component.scss',
})
export class RiskFormComponent {
  @Input() risk: Risk | null = null;
  riskForm: FormGroup;
  @Output() submitted: EventEmitter<Risk> = new EventEmitter<Risk>();

  constructor(private fb: FormBuilder) {
    this.riskForm = this.fb.group({
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

  ngOnInit() {
    if (this.risk) {
      this.riskForm.patchValue({
        description: this.risk.description,
        impact: this.risk.impact,
        likelihood: this.risk.likelihood,
      });
    }
  }

  onSubmit() {
    if (this.riskForm.valid) {
      console.log('Risk Form Submitted!', this.riskForm.value);
      const emittedValue: Risk = {
        id: this.risk?.id || '',
        description: this.riskForm.value.description,
        impact: this.riskForm.value.impact,
        likelihood: this.riskForm.value.likelihood,
        projectId: this.risk?.projectId || '',
        status: this.risk?.status || 'OPEN',
        createdBy: this.risk?.createdBy || '',
        createdAt: this.risk?.createdAt || new Date(),
      };
      this.submitted.emit(emittedValue);
    }
  }
}
