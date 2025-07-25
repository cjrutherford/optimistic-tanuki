import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TextAreaComponent } from '@optimistic-tanuki/form-ui';

@Component({
  selector: 'lib-project-journal-form',
  imports: [CommonModule, ReactiveFormsModule, TextAreaComponent, ButtonComponent, CardComponent],
  templateUrl: './project-journal-form.component.html',
  styleUrl: './project-journal-form.component.scss',
})
export class ProjectJournalFormComponent {
  journalForm: FormGroup;

  constructor(private readonly fb: FormBuilder) {
    this.journalForm = this.fb.group({
      content: this.fb.control(''),
    });
  }

  onSubmit() {
    if (this.journalForm.valid) {
      console.log('Journal Entry Submitted!', this.journalForm.value);
    }
  }
}
