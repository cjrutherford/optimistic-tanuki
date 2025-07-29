import { Component, signal } from '@angular/core';
import { CreateProject, Project } from '@optimistic-tanuki/ui-models';
import { ProjectFormComponent, ProjectOverviewComponent, ProjectSelectorComponent } from '@optimistic-tanuki/project-ui';

import { CommonModule } from '@angular/common';
import { ModalComponent } from '@optimistic-tanuki/common-ui';
import { ProjectService } from '../../project/project.service';

@Component({
  selector: 'app-projects',
  imports: [CommonModule, ModalComponent, ProjectOverviewComponent, ProjectSelectorComponent, ProjectFormComponent],
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

  ngOnInit() {
    this.projectService.getProjects().subscribe({
      next: (projects) => {
        console.log('Projects loaded:', projects);
        this.projects.set(projects);
      },
      error: (error) => {
        console.error('Error loading projects:', error);
      },
    })
  }

  onProjectSelected(projectId: string) {
    console.log('Selected project ID:', projectId);
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
