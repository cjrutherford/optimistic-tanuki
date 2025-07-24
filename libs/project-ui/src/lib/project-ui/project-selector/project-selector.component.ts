import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { Change, Project, ProjectJournal, Risk, Task, Timer } from '@optimistic-tanuki/ui-models';
import { Component, EventEmitter, Output, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { CommonModule } from '@angular/common';
import { SelectComponent } from '@optimistic-tanuki/form-ui';

@Component({
  selector: 'lib-project-selector',
  imports: [CommonModule, CardComponent, ReactiveFormsModule, SelectComponent, ButtonComponent],
  templateUrl: './project-selector.component.html',
  styleUrl: './project-selector.component.scss',
})
export class ProjectSelectorComponent {
  availableProjects = signal<Project[]>([]);
  projectSelectionForm: FormGroup;
  @Output() projectSelected: EventEmitter<string> = new EventEmitter<string>();
  @Output() editProject: EventEmitter<void> = new EventEmitter<void>();
  @Output() deleteProject: EventEmitter<void> = new EventEmitter<void>();

  // Prepare options for the SelectComponent
  get projectOptions() {
    return this.availableProjects().map(project => ({
      value: project.id,
      label: project.name
    }));
  }

  constructor(private readonly fb: FormBuilder) {
    this.projectSelectionForm = this.fb.group({
      project: this.fb.control('')
    });
  }

  ngOnInit(): void {
    // Initialize form values or perform any setup logic here
    this.projectSelectionForm.valueChanges.subscribe((value) => {
      console.log('Selected project:', value.project);
      // Handle project selection change
    });
    this.availableProjects.set([
      {
        id: '1',
        name: 'Project Alpha',
        owner: 'John Doe',
        members: ['Alice', 'Bob'],
        createdBy: 'John Doe',
        createdAt: new Date(),
        description: 'This is the first project.',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
        status: 'active',
        tasks: [] as Task[],
        risks: [] as Risk[],
        changes: [] as Change[],
        journalEntries: [] as ProjectJournal[],
        timers: [] as Timer[]
      },
      {
        id: '2',
        name: 'Project Beta',
        description: 'This is the second project.',
        startDate: new Date('2023-02-01'),
        endDate: new Date('2023-11-30'),
        status: 'active',
        tasks: [],
        risks: [],
        changes: [],
        journalEntries: [],
        timers: [],
        owner: '',
        members: [],
        createdBy: '',
        createdAt: new Date(),
      }
    ])
  }

  onProjectSelected(projectId: string) {
    this.projectSelectionForm.get('project')?.setValue(projectId);
  }
}
