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


import { SelectComponent } from '@optimistic-tanuki/form-ui';

@Component({
  selector: 'lib-project-selector',
  imports: [
    CardComponent,
    ReactiveFormsModule,
    SelectComponent,
    ButtonComponent
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

  projectForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.projectForm = this.fb.group({
      project: this.fb.control<string | null>(null),
    });
  }

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
    if (this.projects.length > 0) {
      this.selectedProject.set(this.projects[0]);
      this.projectForm.patchValue({ project: this.projects[0].id });
    } else {
      this.selectedProject.set(null);
    }
    this.projectForm.valueChanges.subscribe((value) => {
      const selectedId = value.project;
      this.selectedProject.set(
        this.projects.find((p) => p.id === selectedId) || null
      );
      this.projectSelected.emit(selectedId);
    });
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
