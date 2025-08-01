import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { CommonModule } from '@angular/common';
import { CreateProjectJournal } from '@optimistic-tanuki/ui-models';
import { TextAreaComponent } from '@optimistic-tanuki/form-ui';

@Component({
  selector: 'lib-project-journal-form',
  imports: [CommonModule, ReactiveFormsModule, TextAreaComponent, ButtonComponent, CardComponent],
  templateUrl: './project-journal-form.component.html',
  styleUrl: './project-journal-form.component.scss',
})
export class ProjectJournalFormComponent {
  journalForm: FormGroup;
  @Output() submitted: EventEmitter<CreateProjectJournal> = new EventEmitter<CreateProjectJournal>();

  constructor(private readonly fb: FormBuilder) {
    this.journalForm = this.fb.group({
      content: this.fb.control(''),
    });
  }

  onSubmit() {
    if (this.journalForm.valid) {
      console.log('Journal Entry Submitted!', this.journalForm.value);
      this.submitted.emit({
        ...this.journalForm.value,
        projectId: '',
        profileId: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }
}
