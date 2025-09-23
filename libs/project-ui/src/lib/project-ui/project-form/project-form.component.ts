import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CreateProject, Project } from '@optimistic-tanuki/ui-models';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SelectComponent, TextAreaComponent, TextInputComponent } from '@optimistic-tanuki/form-ui';



@Component({
  selector: 'lib-project-form',
  imports: [ReactiveFormsModule, CardComponent, TextInputComponent, TextAreaComponent, ButtonComponent, SelectComponent],
  templateUrl: './project-form.component.html',
  styleUrl: './project-form.component.scss',
})
export class ProjectFormComponent {
  @Input() project: Project | null = null;
  projectForm: FormGroup;
  @Output() submitEvent: EventEmitter<CreateProject> = new  EventEmitter<CreateProject>();

  constructor(private readonly fb: FormBuilder) {
    this.projectForm = this.fb.group({
      projectName: this.fb.control(''),
      projectDescription: this.fb.control(''),
    });
  }

  ngOnInit(): void {
    if (this.project) {
      this.projectForm.patchValue({
        projectName: this.project.name,
        projectDescription: this.project.description,
      });
    }
  }

  onSubmit() {
        if (this.projectForm.valid && this.projectForm.value.projectName && this.projectForm.value.projectDescription) {
      console.log('Form Submitted!', this.projectForm.value);
      this.submitEvent.emit({
        name: this.projectForm.value.projectName,
        description: this.projectForm.value.projectDescription,
        status: '',
        owner: '',
        members: [],
        startDate: new Date(),
        createdBy: '',
      });
    }
  }
}
