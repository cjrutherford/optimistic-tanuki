import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { Component, EventEmitter, Output } from '@angular/core';
import { CreateProfileDto, ProfileDto, Task, UpdateProfileDto } from '@optimistic-tanuki/ui-models';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SelectComponent, TextAreaComponent, TextInputComponent } from '@optimistic-tanuki/form-ui';

import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-task-form',
  imports: [CommonModule, ReactiveFormsModule, CardComponent, TextInputComponent, TextAreaComponent, ButtonComponent, SelectComponent],
  templateUrl: './task-form.component.html',
  styleUrl: './task-form.component.scss',
})
export class TaskFormComponent {
  @Output() formSubmit: EventEmitter<Task> = new EventEmitter<Task>();
  statusOptions = [
    { value: 'TODO', label: 'To Do' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'DONE', label: 'Done' },
    { value: 'ARCHIVED', label: 'Archived' },
  ];
  priorityOptions = [
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM_LOW', label: 'Medium Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'MEDIUM_HIGH', label: 'Medium High' },
    { value: 'HIGH', label: 'High' },
  ];
  taskForm: FormGroup;
  constructor(private readonly fb: FormBuilder) {
    this.taskForm = this.fb.group({
      title: this.fb.control(''),
      description: this.fb.control(''),
      status: this.fb.control('TODO'),
      priority: this.fb.control('MEDIUM'),
    });
  }

  selectChange(event: any, field: string) {
    console.log(`Patching value for ${field}:`, event.target.value);
    this.taskForm.patchValue({ [field]: event.target.value });
  }

  onSubmit() {
    if (this.taskForm.valid) {
      console.log('Form Submitted!', this.taskForm.value);
      this.formSubmit.emit({
        ...this.taskForm.value,
        projectId: '',
        asignee: '',
      } as Task);
      this.taskForm.reset();
    }
  }
}
