import { ButtonComponent, CardComponent, ModalComponent, TileComponent } from '@optimistic-tanuki/common-ui';
import { ChangesTableComponent, ProjectFormComponent, ProjectJournalTableComponent, ProjectOverviewComponent, ProjectSelectorComponent, RisksTableComponent, SummaryBlockComponent, TasksTableComponent } from '@optimistic-tanuki/project-ui';
import { Component, computed, signal } from '@angular/core';
import { CreateProject, Project } from '@optimistic-tanuki/ui-models';

import { CommonModule } from '@angular/common';
import { ProjectService } from '../../project/project.service';

@Component({
  selector: 'app-projects',
  imports: [
    CommonModule, 
    ModalComponent, 
    CardComponent,
    SummaryBlockComponent,
    TasksTableComponent,
    RisksTableComponent,
    ChangesTableComponent,
    ButtonComponent,
    TileComponent,
    ProjectJournalTableComponent,
    ProjectSelectorComponent, 
    ProjectFormComponent
  ],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss',
})
export class ProjectsComponent {
  constructor(
    private readonly projectService: ProjectService,
  ) {}

  projects = signal<Project[]>([]);

  showCreateModal = signal<boolean>(false);
  showEditModal = signal<boolean>(false);
  showDeleteModal = signal<boolean>(false);
  selectedProjectIndex = signal<number | null>(null);
  selectedProject = signal<Project | null>(null);
  detailsShown = signal<boolean>(false); // Whether to show the details section
  shownDetails = signal<'tasks' | 'risks' | 'changes' | 'journal'>('tasks'); // Details to show

  showDetails(details: 'tasks' | 'risks' | 'changes' | 'journal'): void {
    console.log('Showing details:', details);
    this.selectedProjectIndex.set(this.projects().findIndex(p => p.id === this.selectedProject()?.id));
    this.shownDetails.set(details);
    this.detailsShown.set(true);
  }

  hideDetails(): void {
    console.log('Hiding details');
    this.detailsShown.set(false);
    this.shownDetails.set('tasks'); // Reset to tasks view
  }

  taskCount = computed(() => {
    const selectedProject = this.selectedProject();
    if (!selectedProject) return 0;
    if (!selectedProject.tasks) return 0;
    return selectedProject.tasks.filter(t => !['DONE', 'ARCHIVED'].includes(t.status))?.length || 0;
  });

  riskCount = computed(() => {
    const selectedProject = this.selectedProject();
    if (!selectedProject) return 0;
    if (!selectedProject.risks) return 0;
    return selectedProject.risks.filter(r => r.status !== 'CLOSED')?.length || 0;
  });

  changeCount = computed(() => {
    const selectedProject = this.selectedProject();
    if (!selectedProject) return 0;
    if (!selectedProject.changes) return 0;
    return selectedProject.changes.filter(c => !['COMPLETE', 'DISCARDED'].includes(c.changeStatus))?.length || 0;
  });

  ngOnInit() {
    console.log('ProjectsComponent initialized');
    this.loadProjects();
  }

  

  private loadProjects() {
    this.projectService.getProjects().subscribe({
      next: (projects) => {
        console.log('Projects loaded:', projects);
        this.projects.set(projects);
        this.selectedProject.set(projects.length > 0 ? projects[0] : null);
      },
      error: (error) => {
        console.error('Error loading projects:', error);
      },
    });
  }

  onProjectSelected(projectId: string) {
    console.log('Selected project ID:', projectId);
    const project = this.projects().find(p => p.id === projectId);
    if (project) {
      this.selectedProject.set(project);
      console.log('Selected project:', project);
    }
  }

  onCreateProject() {
    console.log('Create project clicked');
    this.showCreateModal.set(true);
  }

  onEditProject(project: Project) {
    console.log('Edit project clicked');
    this.selectedProject.set(project);
    this.showEditModal.set(true);
  }

  onDeleteProject() {
    console.log('Delete project clicked');
    this.showDeleteModal.set(true);
  }

  onProjectCreated(project: CreateProject) {
    const newProject: CreateProject = project;
    console.log('Project created:', newProject);
    this.projectService.createProject(newProject).subscribe({
      next: (createdProject) => {
        console.log('New project created:', createdProject);
        this.projects.update((currentProjects) => [...currentProjects, createdProject]); 
        this.loadProjects();
        this.showCreateModal.set(false);
      },
      error: (error) => {
        console.error('Error creating project:', error);
      },
    });
  }

  onProjectUpdated(project: CreateProject) {
    const updatedProject: Project = { ...this.selectedProject(), ...project } as Project;
    console.log('Project updated:', updatedProject);

    this.projectService.updateProject(updatedProject).subscribe({
      next: (systemUpdatedProject) => {
        console.log('Project updated successfully:', systemUpdatedProject);
        this.projects.update((currentProjects) =>
          currentProjects.map((p) => (p.id === systemUpdatedProject.id ? systemUpdatedProject : p))
        );
        this.showEditModal.set(false);
      },
      error: (error) => {
        console.error('Error updating project:', error);
      },
    });
  }
}
