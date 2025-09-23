import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { Change, CreateChange } from '@optimistic-tanuki/ui-models';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SelectComponent, TextAreaComponent, TextInputComponent } from '@optimistic-tanuki/form-ui';



@Component({
  selector: 'lib-change-form',
  imports: [ReactiveFormsModule, CardComponent, TextInputComponent, TextAreaComponent, ButtonComponent, SelectComponent],
  templateUrl: './change-form.component.html',
  styleUrl: './change-form.component.scss',
})
export class ChangeFormComponent {
  @Input() change: Change | null = null;
  isEditing = signal<boolean>(false);
  changeForm : FormGroup;
  @Output() submitted: EventEmitter<Partial<Change>> = new EventEmitter<Partial<Change>>();
  constructor(private readonly fb: FormBuilder) {
    this.changeForm = this.fb.group({
      changeType: this.fb.control('ADDITION'),
      changeDescription: this.fb.control(''),
      changeStatus: this.fb.control('PENDING'),
      changeDate: this.fb.control(''),
      requestor: this.fb.control(''),
    });
  }

  ngOnInit() {
    if (this.change) {
      this.isEditing.set(true);
      this.changeForm.patchValue({
        changeType: this.change.changeType,
        changeDescription: this.change.changeDescription,
        changeStatus: this.change.changeStatus,
        changeDate: this.change.changeDate,
        requestor: this.change.requestor,
      });
    } else {
      this.isEditing.set(false);
    }
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
      this.submitted.emit(this.changeForm.value);
    }
  }
}
