import { ButtonComponent, CardComponent, ModalComponent, TileComponent } from '@optimistic-tanuki/common-ui';
import { Change, CreateChange, CreateProject, CreateProjectJournal, CreateRisk, CreateTask, Project, ProjectJournal, Risk, Task } from '@optimistic-tanuki/ui-models';
import { ChangesTableComponent, ProjectFormComponent, ProjectJournalTableComponent, ProjectOverviewComponent, ProjectSelectorComponent, RisksTableComponent, SummaryBlockComponent, TasksTableComponent } from '@optimistic-tanuki/project-ui';
import { Component, computed, signal } from '@angular/core';

import { ChangeService } from '../../change/change.service';
import { CommonModule } from '@angular/common';
import { JournalService } from '../../journal/journal.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { ProjectService } from '../../project/project.service';
import { RiskService } from '../../risk/risk.service';
import { TaskService } from '../../task/task.service';

@Component({
  selector: 'app-projects',
  standalone: true,
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
  providers: [
    ProjectService,
    TaskService,
    RiskService,
    ChangeService,
    JournalService,
  ],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss',
})
export class ProjectsComponent {
  constructor(
    private readonly projectService: ProjectService,
    private readonly taskService: TaskService,
    private readonly riskService: RiskService,
    private readonly changeService: ChangeService,
    private readonly journalService: JournalService,
    private readonly messageService: MessageService,
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
        this.messageService.addMessage({
          content: 'Error loading projects: ' + (error.message || 'Unknown error'),
          type: 'error',
        });
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

  onDeleteTask(taskId: string) {
    console.log('Delete task with ID:', taskId);
    this.taskService.deleteTask(taskId).subscribe({
      next: () => {
        console.log('Task deleted successfully');
        this.selectedProject.update((project) => {
          if (!project) return project;
          this.messageService.addMessage({
            content: 'Task deleted successfully',
            type: 'success',
          });
          return {
            ...project,
            tasks: project.tasks.filter(t => t.id !== taskId),
          };
        });
      },
      error: (error) => {
        console.error('Error deleting task:', error);
        this.messageService.addMessage({
          content: 'Error deleting task: ' + (error.message || 'Unknown error'),
          type: 'error',
        });
      },
    });
  }

  onCreateTask(task: CreateTask) {
    console.log('Create task:', task);
    const currentProject = this.selectedProject();
    if (!currentProject) {
      console.error('No project selected for task creation');
      return;
    }
    console.log('Current project for task creation:', currentProject);
    task.projectId = currentProject.id;
    this.taskService.createTask(task).subscribe({
      next: (createdTask) => {
        console.log('Task created successfully:', createdTask);
        const currentProject = this.selectedProject();
        if (!currentProject) {
          console.error('No project selected to update with new task');
          this.messageService.addMessage({
            content: 'No project selected to update with new task',
            type: 'error',
          });
          return;
        }
        currentProject.tasks = [...(currentProject.tasks || []), createdTask];
        this.selectedProject.set(currentProject);
        console.log('Updated project with new task:', currentProject);
        this.messageService.addMessage({
          content: 'Task created successfully',
          type: 'success',
        });
      },
      error: (error) => {
        console.error('Error creating task:', error);
        this.messageService.addMessage({
          content: 'Error creating task: ' + (error.message || 'Unknown error'),
          type: 'error',
        });
      },
    });
  }

  onEditTask(task: Task) {
    console.log('Edit task:', task);
    this.taskService.updateTask(task).subscribe({
      next: (updatedTask) => {
        console.log('Task updated successfully:', updatedTask);
        this.messageService.addMessage({
          content: 'Task updated successfully',
          type: 'success',
        });
        this.selectedProject.update((project) => {
          if (!project) return project;
          return {
            ...project,
            tasks: project.tasks.map(t => (t.id === updatedTask.id ? updatedTask : t)),
          };
        });
      },
      error: (error) => {
        console.error('Error updating task:', error);
        this.messageService.addMessage({
          content: 'Error updating task: ' + (error.message || 'Unknown error'),
          type: 'error',
        });
      },
    });
  }

  onCreateRisk(risk: CreateRisk) {
    console.log('Create risk:', risk);
    const currentProject = this.selectedProject();
    if (!currentProject) {
      console.error('No project selected for risk creation');
      return;
    }
    console.log('Current project for risk creation:', currentProject);
    risk.projectId = currentProject.id;
    this.riskService.createRisk(risk).subscribe({
      next: (createdRisk) => {
        this.messageService.addMessage({
          content: 'Risk created successfully',
          type: 'success',
        });
        console.log('Risk created successfully:', createdRisk);
        currentProject.risks = [...(currentProject.risks || []), createdRisk];
        this.selectedProject.set(currentProject);
        console.log('Updated project with new risk:', currentProject);
      },
      error: (error) => {
        console.error('Error creating risk:', error);
        this.messageService.addMessage({
          content: 'Error creating risk: ' + (error.message || 'Unknown error'),
          type: 'error',
        });
      },
    });
  }

  onEditRisk(risk: Risk) {
    console.log('Edit risk:', risk);
    this.riskService.updateRisk(risk.id, risk).subscribe({
      next: (updatedRisk) => {
        console.log('Risk updated successfully:', updatedRisk);
        this.messageService.addMessage({
          content: 'Risk updated successfully',
          type: 'success',
        });
        this.selectedProject.update((project) => {
          if (!project) return project;
          return {
            ...project,
            risks: project.risks.map(r => (r.id === updatedRisk.id ? updatedRisk : r)),
          };
        });
      },
      error: (error) => {
        this.messageService.addMessage({
          content: 'Error updating risk: ' + (error.message || 'Unknown error'),
          type: 'error',
        });
        console.error('Error updating risk:', error);
      },
    });
  }

  onDeleteRisk(riskId: string) {
    console.log('Delete risk with ID:', riskId);
    this.riskService.deleteRisk(riskId).subscribe({
      next: () => {
        this.messageService.addMessage({
          content: 'Risk deleted successfully',
          type: 'success',
        });
        console.log('Risk deleted successfully');
        this.selectedProject.update((project) => {
          if (!project) return project;
          return {
            ...project,
            risks: project.risks.filter(r => r.id !== riskId),
          };
        });
      },
      error: (error) => {
        console.error('Error deleting risk:', error);
        this.messageService.addMessage({
          content: 'Error deleting risk: ' + (error.message || 'Unknown error'),
          type: 'error',
        });
      },
    });
  }

  onProjectCreated(project: CreateProject) {
    const newProject: CreateProject = project;
    console.log('Project created:', newProject);
    this.projectService.createProject(newProject).subscribe({
      next: (createdProject) => {
        this.messageService.addMessage({
          content: 'New project created successfully',
          type: 'success',
        });
        console.log('New project created:', createdProject);
        this.projects.update((currentProjects) => [...currentProjects, createdProject]); 
        this.loadProjects();
        this.showCreateModal.set(false);
      },
      error: (error) => {
        console.error('Error creating project:', error);
        this.messageService.addMessage({
          content: 'Error creating project: ' + (error.message || 'Unknown error'),
          type: 'error',
        });
        this.showCreateModal.set(false);
      },
    });
  }

  onProjectUpdated(project: CreateProject) {
    const updatedProject: Project = { ...this.selectedProject(), ...project } as Project;
    console.log('Project updated:', updatedProject);

    this.projectService.updateProject(updatedProject).subscribe({
      next: (systemUpdatedProject) => {
        this.messageService.addMessage({
          content: 'Project updated successfully',
          type: 'success',
        });
        console.log('Project updated successfully:', systemUpdatedProject);
        this.projects.update((currentProjects) =>
          currentProjects.map((p) => (p.id === systemUpdatedProject.id ? systemUpdatedProject : p))
        );
        this.showEditModal.set(false);
      },
      error: (error) => {
        console.error('Error updating project:', error);
        this.messageService.addMessage({
          content: 'Error updating project: ' + (error.message || 'Unknown error'),
          type: 'error',
        });
      },
    });
  }

  onCreateChange(change: CreateChange) {
    console.log('Create change:', change);
    const currentProject = this.selectedProject();
    if (!currentProject) {
      console.error('No project selected for change creation');
      return;
    }
    console.log('Current project for change creation:', currentProject);
    change.projectId = currentProject.id;
    this.changeService.createChange(change).subscribe({
      next: (createdChange) => {
        this.messageService.addMessage({
          content: 'Change created successfully',
          type: 'success',
        });
        console.log('Change created successfully:', createdChange);
        currentProject.changes = [...(currentProject.changes || []), createdChange];
        this.selectedProject.set(currentProject);
        console.log('Updated project with new change:', currentProject);
      },
      error: (error) => {
        console.error('Error creating change:', error);
        this.messageService.addMessage({
          content: 'Error creating change: ' + (error.message || 'Unknown error'),
          type: 'error',
        });
      },
    });
  }

  onEditChange(change: Change) {
    console.log('Edit change:', change);
    this.changeService.updateChange(change).subscribe({
      next: (updatedChange) => {
        this.messageService.addMessage({
          content: 'Change updated successfully',
          type: 'success',
        });
        console.log('Change updated successfully:', updatedChange);
        this.selectedProject.update((project) => {
          if (!project) return project;
          return {
            ...project,
            changes: project.changes.map(c => (c.id === updatedChange.id ? updatedChange : c)),
          };
        });
      },
      error: (error) => {
        console.error('Error updating change:', error);
        this.messageService.addMessage({
          content: 'Error updating change: ' + (error.message || 'Unknown error'),
          type: 'error',
        });
      },
    });
  }

  onDeleteChange(changeId: string) {
    console.log('Delete change with ID:', changeId);
    this.changeService.deleteChange(changeId).subscribe({
      next: () => {
        console.log('Change deleted successfully');
        this.messageService.addMessage({
          content: 'Change deleted successfully',
          type: 'success',
        });
        this.selectedProject.update((project) => {
          if (!project) return project;
          return {
            ...project,
            changes: project.changes.filter(c => c.id !== changeId),
          };
        });
      },
      error: (error) => {
        console.error('Error deleting change:', error);
        this.messageService.addMessage({
          content: 'Error deleting change: ' + (error.message || 'Unknown error'),
          type: 'error',
        });
      },
    });
  }


  onCreateJournalEntry(entry: CreateProjectJournal) {
    console.log('Create journal entry:', entry);
    const currentProject = this.selectedProject();
    if (!currentProject) {
      console.error('No project selected for journal entry creation');
      return;
    }
    console.log('Current project for journal entry creation:', currentProject);
    entry.projectId = currentProject.id;
    entry.profileId = currentProject.owner;
    this.journalService.createJournalEntry(entry).subscribe({
      next: (createdEntry) => {
        this.messageService.addMessage({
          content: 'Journal entry created successfully',
          type: 'success',
        });
        console.log('Journal entry created successfully:', createdEntry);
        currentProject.journalEntries = [...(currentProject.journalEntries || []), createdEntry];
        this.selectedProject.set(currentProject);
        console.log('Updated project with new journal entry:', currentProject);
      },
      error: (error) => {
        console.error('Error creating journal entry:', error);
        this.messageService.addMessage({
          content: 'Error creating journal entry: ' + (error.message || 'Unknown error'),
          type: 'error',
        });
      },
    });
  }

  onUpdateJournalEntry(entry: ProjectJournal) {
    console.log('Update journal entry:', entry);
    this.journalService.updateJournalEntry(entry).subscribe({
      next: (updatedEntry) => {
        this.messageService.addMessage({
          content: 'Journal entry updated successfully',
          type: 'success',
        });
        console.log('Journal entry updated successfully:', updatedEntry);
        this.selectedProject.update((project) => {
          if (!project) return project;
          return {
            ...project,
            journalEntries: project.journalEntries.map(e => (e.id === updatedEntry.id ? updatedEntry : e)),
          };
        });
      },
      error: (error) => {
        console.error('Error updating journal entry:', error);
        this.messageService.addMessage({
          content: 'Error updating journal entry: ' + (error.message || 'Unknown error'),
          type: 'error',
        });
      },
    });
  }

  onDeleteJournalEntry(entryId: string) {
    console.log('Delete journal entry with ID:', entryId);
    this.journalService.deleteJournalEntry(entryId).subscribe({
      next: () => {
        console.log('Journal entry deleted successfully');
        this.messageService.addMessage({
          content: 'Journal entry deleted successfully',
          type: 'success',
        });
        this.selectedProject.update((project) => {
          if (!project) return project;
          return {
            ...project,
            journalEntries: project.journalEntries.filter(e => e.id !== entryId),
          };
        });
      },
      error: (error) => {
        console.error('Error deleting journal entry:', error);
        this.messageService.addMessage({
          content: 'Error deleting journal entry: ' + (error.message || 'Unknown error'),
          type: 'error',
        });
      },
    });
  }
}