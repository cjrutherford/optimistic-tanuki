import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { Component, EventEmitter, Input, Output, signal, OnInit } from '@angular/core';
import { CreateProjectJournal, ProjectJournal } from '@optimistic-tanuki/ui-models';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';


import { TextAreaComponent } from '@optimistic-tanuki/form-ui';

@Component({
  selector: 'lib-project-journal-form',
  imports: [ReactiveFormsModule, TextAreaComponent, ButtonComponent, CardComponent],
  templateUrl: './project-journal-form.component.html',
  styleUrl: './project-journal-form.component.scss',
})
export class ProjectJournalFormComponent implements OnInit {
  @Input() journal: ProjectJournal | null = null;
  isEditing = signal<boolean>(false);
  journalForm: FormGroup;
  @Output() submitted: EventEmitter<Partial<ProjectJournal>> = new EventEmitter<Partial<ProjectJournal>>();

  constructor(private readonly fb: FormBuilder) {
    this.journalForm = this.fb.group({
      content: this.fb.control(''),
    });
  }

  ngOnInit() {
    if (this.journal) {
      this.journalForm.patchValue({
        content: this.journal.content,
      });
    }
  }

  onSubmit() {
    if (this.journalForm.valid) {
      console.log('Journal Entry Submitted!', this.journalForm.value);
      this.submitted.emit({
        ...this.journal,
        ...this.journalForm.value,
      });
    }
  }
}
