import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SelectComponent, TextAreaComponent, TextInputComponent } from '@optimistic-tanuki/form-ui';

import { CommonModule } from '@angular/common';
import { CreateChange } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'lib-change-form',
  imports: [CommonModule, ReactiveFormsModule, CardComponent, TextInputComponent, TextAreaComponent, ButtonComponent, SelectComponent],
  templateUrl: './change-form.component.html',
  styleUrl: './change-form.component.scss',
})
export class ChangeFormComponent {
  changeForm : FormGroup;
  @Output() submitted: EventEmitter<CreateChange> = new EventEmitter<CreateChange>();
  constructor(private readonly fb: FormBuilder) {
    this.changeForm = this.fb.group({
      changeType: this.fb.control('ADDITION'),
      changeDescription: this.fb.control(''),
      changeDate: this.fb.control(''),
      requestor: this.fb.control(''),
    });
  }

  statusOptions = [
    { value: 'PENDING', label: 'Pending' },
    { value: 'RESEARCHING', label: 'Researching' },
    { value: 'DISCUSSING', label: 'Discussing' },
    { value: 'DESIGNING', label: 'Designing' },
    { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
    { value: 'IMPLEMENTING', label: 'Implementing' },
    { value: 'COMPLETE', label: 'Complete' },
    { value: 'DISCARDED', label: 'Discarded' },
  ];

  changeTypeOptions = [
    { value: 'ADDITION', label: 'Addition' },
    { value: 'MODIFICATION', label: 'Modification' },
    { value: 'DELETION', label: 'Deletion' },
  ];


  onSubmit() {
    if (this.changeForm.valid) {
      console.log('Form Submitted!', this.changeForm.value);
      this.submitted.emit(this.changeForm.value as CreateChange);
    }
  }
}
