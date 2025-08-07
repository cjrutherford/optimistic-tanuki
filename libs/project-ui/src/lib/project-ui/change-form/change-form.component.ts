import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { Change, CreateChange } from '@optimistic-tanuki/ui-models';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SelectComponent, TextAreaComponent, TextInputComponent } from '@optimistic-tanuki/form-ui';

import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-change-form',
  imports: [CommonModule, ReactiveFormsModule, CardComponent, TextInputComponent, TextAreaComponent, ButtonComponent, SelectComponent],
  templateUrl: './change-form.component.html',
  styleUrl: './change-form.component.scss',
})
/**
 * Component for creating or editing a change request.
 */
@Component({
  selector: 'lib-change-form',
  imports: [CommonModule, ReactiveFormsModule, CardComponent, TextInputComponent, TextAreaComponent, ButtonComponent, SelectComponent],
  templateUrl: './change-form.component.html',
  styleUrl: './change-form.component.scss',
})
export class ChangeFormComponent {
  /**
   * The change object to pre-fill the form (optional).
   */
  @Input() change: Change | null = null;
  /**
   * Signal indicating whether the form is in editing mode.
   */
  isEditing = signal<boolean>(false);
  /**
   * The form group for the change request.
   */
  changeForm : FormGroup;
  /**
   * Emits the form data when submitted.
   */
  @Output() submitted: EventEmitter<Partial<Change>> = new EventEmitter<Partial<Change>>();
  /**
   * Creates an instance of ChangeFormComponent.
   * @param fb The FormBuilder instance.
   */
  constructor(private readonly fb: FormBuilder) {
    this.changeForm = this.fb.group({
      changeType: this.fb.control('ADDITION'),
      changeDescription: this.fb.control(''),
      changeStatus: this.fb.control('PENDING'),
      changeDate: this.fb.control(''),
      requestor: this.fb.control(''),
    });
  }

  /**
   * Initializes the component and sets up the form based on whether a change object is provided.
   */
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

  /**
   * Options for the change status select input.
   */
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

  /**
   * Options for the change type select input.
   */
  changeTypeOptions = [
    { value: 'ADDITION', label: 'Addition' },
    { value: 'MODIFICATION', label: 'Modification' },
    { value: 'DELETION', label: 'Deletion' },
  ];


  /**
   * Handles the form submission.
   */
  onSubmit() {
    if (this.changeForm.valid) {
      console.log('Form Submitted!', this.changeForm.value);
      this.submitted.emit(this.changeForm.value);
    }
  }
}
