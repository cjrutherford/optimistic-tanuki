import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SelectComponent, TextAreaComponent, TextInputComponent } from '@optimistic-tanuki/form-ui';

import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'lib-project-form',
  imports: [CommonModule, ReactiveFormsModule, CardComponent, TextInputComponent, TextAreaComponent, ButtonComponent, SelectComponent],
  templateUrl: './project-form.component.html',
  styleUrl: './project-form.component.scss',
})
export class ProjectFormComponent {
  projectForm: FormGroup;

  constructor(private readonly fb: FormBuilder) {
    this.projectForm = this.fb.group({
      projectName: this.fb.control(''),
      projectDescription: this.fb.control(''),
    });
  }

  onSubmit() {
    if (this.projectForm.valid) {
      console.log('Form Submitted!', this.projectForm.value);
    }
  }
}
