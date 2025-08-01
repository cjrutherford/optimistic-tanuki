import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import {
  Change,
  Project,
  ProjectJournal,
  Risk,
  Task,
  Timer,
} from '@optimistic-tanuki/ui-models';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  SimpleChanges,
  computed,
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { CommonModule } from '@angular/common';
import { SelectComponent } from '@optimistic-tanuki/form-ui';

@Component({
  selector: 'lib-project-selector',
  imports: [
    CommonModule,
    CardComponent,
    ReactiveFormsModule,
    SelectComponent,
    ButtonComponent,
  ],
  templateUrl: './project-selector.component.html',
  styleUrl: './project-selector.component.scss',
})
export class ProjectSelectorComponent {
  @Input() projects: Project[] = [];
  availableProjects = signal<Project[]>([]);
  selectedProject = signal<Project | null>(null);
  @Output() projectSelected: EventEmitter<string> = new EventEmitter<string>();
  @Output() createProject: EventEmitter<void> = new EventEmitter<void>();
  @Output() editProject: EventEmitter<Project> = new EventEmitter<Project>();
  @Output() deleteProject: EventEmitter<void> = new EventEmitter<void>();

  // Prepare options for the SelectComponent
  projectOptions = computed(() =>
    this.availableProjects().map((project) => ({
      value: project.id,
      label: project.name,
    }))
  );


  ngOnChanges(changes: SimpleChanges) {
    if (changes['projects']) {
      this.availableProjects.set(this.projects);
    }
  }

  ngOnInit(): void {
    this.availableProjects.set(this.projects);
  }

  onCreateClick() {
    this.createProject.emit();
  }

  onProjectSelected(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    const projectId = selectElement.value;
    console.log('Selected project ID:', projectId);
    this.selectedProject.set(this.projects.find(p => p.id === projectId) || null);
    this.projectSelected.emit(projectId);
  }
}
