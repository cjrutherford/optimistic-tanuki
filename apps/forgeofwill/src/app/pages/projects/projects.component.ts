import {
  ButtonComponent,
  CardComponent,
  GlassContainerComponent,
  ModalComponent,
  TileComponent,
} from '@optimistic-tanuki/common-ui';
import {
  Change,
  CreateChange,
  CreateProject,
  CreateProjectJournal,
  CreateRisk,
  CreateTask,
  Project,
  ProjectJournal,
  Risk,
  Task,
  TaskTimeEntry,
  UpdateTask,
} from '@optimistic-tanuki/ui-models';
import {
  ProjectFormComponent,
  ProjectSelectorComponent,
  SummaryBlockComponent,
  AgTasksTableComponent,
  AgRisksTableComponent,
  AgChangesTableComponent,
  AgProjectJournalTableComponent,
  TaskCalendarComponent,
  TaskKanbanComponent,
  MindMapComponent,
  ProjectSummaryComponent,
  ProjectNarrative,
  AiChangeReviewComponent,
  AiChange,
  AiChangeDecision,
  TaskTimePanelComponent,
} from '@optimistic-tanuki/project-ui';
import { Component, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ChangeService } from '../../change/change.service';

import { JournalService } from '../../journal/journal.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { ProjectService } from '../../project/project.service';
import { RiskService } from '../../risk/risk.service';
import { TaskService } from '../../task/task.service';
import { TaskTimeEntryService } from '../../task-time-entry/task-time-entry.service';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'app-projects',
  imports: [
    CommonModule,
    ModalComponent,
    CardComponent,
    SummaryBlockComponent,
    AgTasksTableComponent,
    AgRisksTableComponent,
    AgChangesTableComponent,
    AgProjectJournalTableComponent,
    TaskCalendarComponent,
    TaskKanbanComponent,
    MindMapComponent,
    ButtonComponent,
    TileComponent,
    ProjectSelectorComponent,
    ProjectFormComponent,
    GlassContainerComponent,
    ProjectSummaryComponent,
    AiChangeReviewComponent,
    TaskTimePanelComponent,
  ],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss',
  host: {
    '[style.--filter-color]': 'filterColor',
  },
})
export class ProjectsComponent implements OnInit {
  constructor(
    private readonly projectService: ProjectService,
    private readonly taskService: TaskService,
    private readonly riskService: RiskService,
    private readonly changeService: ChangeService,
    private readonly journalService: JournalService,
    private readonly taskTimeEntryService: TaskTimeEntryService,
    private readonly messageService: MessageService,
    private readonly themeService: ThemeService
  ) {}

  filterColor = 'rgba(255,255,255,0.4)';

  projects = signal<Project[]>([]);

  /**
   * The model's read of the selected project.
   *
   * Null until the reader asks. It takes roughly 25 seconds and occupies a
   * model, so running it on every project selection would spend that on
   * people who never looked at the panel.
   */
  timeEntries = signal<TaskTimeEntry[]>([]);
  timerBusyTaskId = signal<string | null>(null);
  aiChanges = signal<AiChange[]>([]);
  aiChangeBusyId = signal<string | null>(null);
  askingForSuggestions = signal<boolean>(false);
  assistantWorking = signal<boolean>(false);
  assistantSaid = signal<string | null>(null);
  narrative = signal<ProjectNarrative | null>(null);
  narrativeLoading = signal<boolean>(false);

  showCreateModal = signal<boolean>(false);
  showEditModal = signal<boolean>(false);
  showDeleteModal = signal<boolean>(false);
  selectedProjectIndex = signal<number | null>(null);
  selectedProject = signal<Project | null>(null);
  detailsShown = signal<boolean>(false); // Whether to show the details section
  shownDetails = signal<'tasks' | 'risks' | 'changes' | 'journal' | 'mindmap'>(
    'tasks'
  ); // Details to show
  taskViewMode = signal<'list' | 'calendar' | 'kanban'>('list'); // Task view mode

  showDetails(
    details: 'tasks' | 'risks' | 'changes' | 'journal' | 'mindmap'
  ): void {
    console.log('Showing details:', details);
    this.selectedProjectIndex.set(
      this.projects().findIndex((p) => p.id === this.selectedProject()?.id)
    );
    this.shownDetails.set(details);
    this.detailsShown.set(true);
  }

  hideDetails(): void {
    console.log('Hiding details');
    this.detailsShown.set(false);
    this.shownDetails.set('tasks'); // Reset to tasks view
  }

  setTaskViewMode(mode: 'list' | 'calendar' | 'kanban'): void {
    console.log('Setting task view mode:', mode);
    this.taskViewMode.set(mode);
  }

  /**
   * Changing project clears any model read along with it.
   *
   * Both places that set the selection go through here. A narrative left in
   * place would sit under a different project's name and read as though it
   * were about that one, which is worse than showing nothing.
   */
  private chooseProject(project: Project | null): void {
    const changed = this.selectedProject()?.id !== project?.id;
    this.selectedProject.set(project);
    if (changed) {
      this.narrative.set(null);
      this.narrativeLoading.set(false);
      this.assistantSaid.set(null);
      this.aiChanges.set([]);
      this.aiChangeBusyId.set(null);
      this.timeEntries.set([]);
      this.timerBusyTaskId.set(null);
    }
    if (project) {
      this.loadAiChanges(project.id);
      this.loadTimeEntries(project.id);
    }
  }

  /**
   * Everything recorded against this project, so the panel can show time per
   * task and a total.
   */
  private refreshTimeEntries(): void {
    const project = this.selectedProject();
    if (project) this.loadTimeEntries(project.id);
  }

  private loadTimeEntries(projectId: string): void {
    this.taskTimeEntryService
      .getTaskTimeEntriesForProject(projectId)
      .subscribe({
        next: (entries) => this.timeEntries.set(entries ?? []),
        error: () => this.timeEntries.set([]),
      });
  }

  private loadAiChanges(projectId: string): void {
    this.projectService.getAiChanges(projectId).subscribe({
      next: (changes) => this.aiChanges.set(changes ?? []),
      // A project with nothing proposed and a project whose proposals could
      // not be fetched look the same on screen, so say which happened.
      error: () => {
        this.aiChanges.set([]);
        this.messageService.addMessage({
          content: 'Proposed changes could not be loaded for this project.',
          type: 'error',
        });
      },
    });
  }

  /**
   * Asks a model what the project is missing.
   *
   * Slow, roughly the same as a summary, because a model is reading the whole
   * project. Nothing it says is applied: every suggestion lands in the list
   * above waiting for a decision.
   */
  onSuggestionsRequested(): void {
    const project = this.selectedProject();
    if (!project || this.askingForSuggestions()) return;

    this.askingForSuggestions.set(true);
    this.projectService.requestAiProposals(project.id).subscribe({
      next: (result) => {
        this.askingForSuggestions.set(false);
        if (result.changes?.length) {
          this.aiChanges.update((changes) => [
            ...(result.changes ?? []),
            ...changes,
          ]);
          return;
        }
        this.messageService.addMessage({
          content:
            result.unavailable ??
            'Nothing was suggested for this project just now.',
          type: 'info',
        });
      },
      error: () => {
        this.askingForSuggestions.set(false);
        this.messageService.addMessage({
          content: 'Suggestions could not be fetched.',
          type: 'error',
        });
      },
    });
  }

  /**
   * Hands an instruction to the assistant.
   *
   * Whatever it does goes through the same tools and the same gate, so on a
   * project that requires approval the result is a proposal in the list rather
   * than a change on the board. The pending list is re-read either way,
   * because that is where its work lands.
   */
  onInstructionGiven(instruction: string): void {
    const project = this.selectedProject();
    if (!project || this.assistantWorking()) return;

    this.assistantWorking.set(true);
    this.assistantSaid.set(null);
    this.projectService.instructAssistant(project.id, instruction).subscribe({
      next: (result) => {
        this.assistantWorking.set(false);
        this.assistantSaid.set(result.said || result.unavailable || null);
        this.loadAiChanges(project.id);
        if (!result.awaitingApproval && result.used?.length) {
          // It did the work outright, which happens on a project that does not
          // require approval. The board has changed underneath the page.
          this.refreshSelectedProject();
        }
      },
      error: () => {
        this.assistantWorking.set(false);
        this.messageService.addMessage({
          content: 'The assistant could not be reached.',
          type: 'error',
        });
      },
    });
  }

  /**
   * The human half of the approval gate.
   *
   * Approving does the work rather than only recording a decision, so the
   * project has to be re-read afterwards: the board now has a row on it that
   * the page has never seen.
   */
  onAiChangeDecided(decision: AiChangeDecision): void {
    if (this.aiChangeBusyId()) return;
    this.aiChangeBusyId.set(decision.id);

    this.projectService.reviewAiChange(decision).subscribe({
      next: (reviewed) => {
        this.aiChanges.update((changes) =>
          changes.map((change) =>
            change.id === reviewed.id ? reviewed : change
          )
        );
        this.aiChangeBusyId.set(null);

        if (reviewed.status === 'REJECTED') {
          this.messageService.addMessage({
            content: 'Rejected. Nothing was changed.',
            type: 'info',
          });
          return;
        }

        if (reviewed.applied) {
          this.messageService.addMessage({
            content: 'Approved and done.',
            type: 'success',
          });
          this.refreshSelectedProject();
        } else {
          // Approved but not carried out. Saying "approved" here would tell
          // the reviewer the board changed when it did not.
          this.messageService.addMessage({
            content: `Approved, but it did not go through: ${
              reviewed.applyError ?? 'no reason was given'
            }`,
            type: 'error',
          });
        }
      },
      error: () => {
        this.aiChangeBusyId.set(null);
        this.messageService.addMessage({
          content: 'That decision could not be recorded.',
          type: 'error',
        });
      },
    });
  }

  private refreshSelectedProject(): void {
    const current = this.selectedProject();
    if (!current) return;
    this.projectService.getProjectById(current.id).subscribe({
      next: (project) => this.selectedProject.set(project),
    });
  }

  onNarrativeRequested(): void {
    const project = this.selectedProject();
    if (!project || this.narrativeLoading()) return;

    this.narrativeLoading.set(true);
    this.projectService.getProjectSummary(project.id).subscribe({
      next: (narrative) => {
        this.narrative.set(narrative);
        this.narrativeLoading.set(false);
      },
      error: () => {
        // The panel says so and the computed figures stay. A failed read is
        // not a reason to take the rest of the page down with it.
        this.narrative.set({
          summary: null,
          model: null,
          discarded: 0,
          unavailable: 'The summary could not be reached just now.',
        });
        this.narrativeLoading.set(false);
      },
    });
  }

  onSummaryEntitySelected(entity: 'tasks' | 'risks' | 'changes' | 'journal') {
    this.showDetails(entity);
  }

  onMindMapNodeSelected(node: {
    type: 'task' | 'risk' | 'change' | 'project';
  }) {
    if (node.type !== 'project') {
      this.showDetails(`${node.type}s` as 'tasks' | 'risks' | 'changes');
    }
  }

  taskCount = computed(() => {
    const selectedProject = this.selectedProject();
    if (!selectedProject) return 0;
    if (!selectedProject.tasks) return 0;
    return (
      selectedProject.tasks.filter(
        (t) => !['DONE', 'ARCHIVED'].includes(t.status)
      )?.length || 0
    );
  });

  riskCount = computed(() => {
    const selectedProject = this.selectedProject();
    if (!selectedProject) return 0;
    if (!selectedProject.risks) return 0;
    return (
      selectedProject.risks.filter((r) => r.status !== 'CLOSED')?.length || 0
    );
  });

  changeCount = computed(() => {
    const selectedProject = this.selectedProject();
    if (!selectedProject) return 0;
    if (!selectedProject.changes) return 0;
    return (
      selectedProject.changes.filter(
        (c) => !['COMPLETE', 'DISCARDED'].includes(c.changeStatus)
      )?.length || 0
    );
  });

  ngOnInit() {
    console.log('ProjectsComponent initialized');
    this.loadProjects();
    const theme = this.themeService.getTheme();
    this.filterColor =
      theme === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)';
  }

  private loadProjects() {
    this.projectService.getProjects().subscribe({
      next: (projects) => {
        console.log('Projects loaded:', projects);
        this.projects.set(projects);
        this.chooseProject(projects.length > 0 ? projects[0] : null);
      },
      error: (error) => {
        console.error('Error loading projects:', error);
        this.messageService.addMessage({
          content:
            'Error loading projects: ' + (error.message || 'Unknown error'),
          type: 'error',
        });
      },
    });
  }

  private loadProject(projectId: string) {
    if (!projectId) return;
    this.projectService.getProjectById(projectId).subscribe({
      next: (project) => {
        console.log('Project reloaded:', project);
        // Update the selected project
        this.chooseProject(project);
        // Also update in the projects list
        this.projects.update((projects) =>
          projects.map((p) => (p.id === projectId ? project : p))
        );
      },
      error: (error) => {
        console.error('Error loading project:', error);
        this.messageService.addMessage({
          content:
            'Error loading project: ' + (error.message || 'Unknown error'),
          type: 'error',
        });
      },
    });
  }

  onProjectSelected(projectId: string) {
    console.log('Selected project ID:', projectId);
    const project = this.projects().find((p) => p.id === projectId);
    if (project) {
      this.chooseProject(project);
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
    if (this.selectedProject()) {
      this.showDeleteModal.set(true);
    }
  }

  cancelDeleteProject(): void {
    this.showDeleteModal.set(false);
  }

  confirmDeleteProject(): void {
    const project = this.selectedProject();
    if (!project) return;

    this.projectService.deleteProject(project.id).subscribe({
      next: () => {
        const remainingProjects = this.projects().filter(
          (currentProject) => currentProject.id !== project.id
        );
        this.projects.set(remainingProjects);
        this.selectedProject.update((selectedProject) =>
          selectedProject?.id === project.id
            ? remainingProjects[0] ?? null
            : selectedProject
        );
        this.showDeleteModal.set(false);
        this.messageService.addMessage({
          content: 'Project deleted successfully',
          type: 'success',
        });
      },
      error: (error) => {
        console.error('Error deleting project:', error);
        this.messageService.addMessage({
          content:
            'Error deleting project: ' + (error.message || 'Unknown error'),
          type: 'error',
        });
      },
    });
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
            tasks: project.tasks.filter((t) => t.id !== taskId),
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

  onEditTask(task: UpdateTask) {
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
            tasks: project.tasks.map((t) =>
              t.id === updatedTask.id ? updatedTask : t
            ),
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

  onTaskDateChanged(event: { taskId: string; dueDate: Date }): void {
    this.taskService
      .updateTask({ id: event.taskId, dueDate: event.dueDate })
      .subscribe({
        next: (updatedTask) => {
          this.selectedProject.update((project) => {
            if (!project) return project;
            return {
              ...project,
              tasks: project.tasks.map((task) =>
                task.id === updatedTask.id ? updatedTask : task
              ),
            };
          });
          this.messageService.addMessage({
            content: 'Task due date updated successfully',
            type: 'success',
          });
        },
        error: () => {
          const project = this.selectedProject();
          if (project) this.loadProject(project.id);
          this.messageService.addMessage({
            content:
              'Unable to update the task due date. The calendar was reset.',
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
            risks: project.risks.map((r) =>
              r.id === updatedRisk.id ? updatedRisk : r
            ),
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
            risks: project.risks.filter((r) => r.id !== riskId),
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
        this.projects.update((currentProjects) => [
          ...currentProjects,
          createdProject,
        ]);
        this.loadProjects();
        this.showCreateModal.set(false);
      },
      error: (error) => {
        console.error('Error creating project:', error);
        this.messageService.addMessage({
          content:
            'Error creating project: ' + (error.message || 'Unknown error'),
          type: 'error',
        });
        this.showCreateModal.set(false);
      },
    });
  }

  onProjectUpdated(project: CreateProject) {
    const updatedProject: Project = {
      ...this.selectedProject(),
      ...project,
    } as Project;
    const updateRequest = {
      id: updatedProject.id,
      name: updatedProject.name,
      description: updatedProject.description,
      startDate: updatedProject.startDate,
      ...(updatedProject.endDate !== undefined
        ? { endDate: updatedProject.endDate }
        : {}),
      status: updatedProject.status,
    };
    console.log('Project updated:', updatedProject);

    this.projectService.updateProject(updateRequest as Project).subscribe({
      next: (systemUpdatedProject) => {
        this.messageService.addMessage({
          content: 'Project updated successfully',
          type: 'success',
        });
        console.log('Project updated successfully:', systemUpdatedProject);
        this.projects.update((currentProjects) =>
          currentProjects.map((p) =>
            p.id === systemUpdatedProject.id
              ? { ...p, ...systemUpdatedProject }
              : p
          )
        );
        this.selectedProject.update((selectedProject) =>
          selectedProject?.id === systemUpdatedProject.id
            ? { ...selectedProject, ...systemUpdatedProject }
            : selectedProject
        );
        this.showEditModal.set(false);
      },
      error: (error) => {
        console.error('Error updating project:', error);
        this.messageService.addMessage({
          content:
            'Error updating project: ' + (error.message || 'Unknown error'),
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
        currentProject.changes = [
          ...(currentProject.changes || []),
          createdChange,
        ];
        this.selectedProject.set(currentProject);
        console.log('Updated project with new change:', currentProject);
      },
      error: (error) => {
        console.error('Error creating change:', error);
        this.messageService.addMessage({
          content:
            'Error creating change: ' + (error.message || 'Unknown error'),
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
            changes: project.changes.map((c) =>
              c.id === updatedChange.id ? updatedChange : c
            ),
          };
        });
      },
      error: (error) => {
        console.error('Error updating change:', error);
        this.messageService.addMessage({
          content:
            'Error updating change: ' + (error.message || 'Unknown error'),
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
            changes: project.changes.filter((c) => c.id !== changeId),
          };
        });
      },
      error: (error) => {
        console.error('Error deleting change:', error);
        this.messageService.addMessage({
          content:
            'Error deleting change: ' + (error.message || 'Unknown error'),
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
        currentProject.journalEntries = [
          ...(currentProject.journalEntries || []),
          createdEntry,
        ];
        this.selectedProject.set(currentProject);
        console.log('Updated project with new journal entry:', currentProject);
      },
      error: (error) => {
        console.error('Error creating journal entry:', error);
        this.messageService.addMessage({
          content:
            'Error creating journal entry: ' +
            (error.message || 'Unknown error'),
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
            journalEntries: project.journalEntries.map((e) =>
              e.id === updatedEntry.id ? updatedEntry : e
            ),
          };
        });
      },
      error: (error) => {
        console.error('Error updating journal entry:', error);
        this.messageService.addMessage({
          content:
            'Error updating journal entry: ' +
            (error.message || 'Unknown error'),
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
            journalEntries: project.journalEntries.filter(
              (e) => e.id !== entryId
            ),
          };
        });
      },
      error: (error) => {
        console.error('Error deleting journal entry:', error);
        this.messageService.addMessage({
          content:
            'Error deleting journal entry: ' +
            (error.message || 'Unknown error'),
          type: 'error',
        });
      },
    });
  }

  onStartTimer(taskId: string) {
    if (this.timerBusyTaskId()) return;
    this.timerBusyTaskId.set(taskId);
    this.taskTimeEntryService.startTimer(taskId).subscribe({
      next: (timeEntry) => {
        this.timerBusyTaskId.set(null);
        this.refreshTimeEntries();
        this.messageService.addMessage({
          content: 'Timer started successfully',
          type: 'success',
        });
        // Fetch the updated task to get all time entries
        this.taskService.getTaskById(taskId).subscribe({
          next: (updatedTask) => {
            // Update the task in the current project without reloading everything
            this.selectedProject.update((project) => {
              if (!project) return project;
              return {
                ...project,
                tasks: project.tasks.map((t) =>
                  t.id === taskId ? updatedTask : t
                ),
              };
            });
          },
          error: (error) => {
            console.error('Error fetching updated task:', error);
            // Fallback to reloading the project
            this.loadProject(this.selectedProject()?.id || '');
          },
        });
      },
      error: (error) => {
        this.timerBusyTaskId.set(null);
        this.messageService.addMessage({
          content:
            'Error starting timer: ' + (error.message || 'Unknown error'),
          type: 'error',
        });
      },
    });
  }

  onStopTimer(timeEntryId: string) {
    if (this.timerBusyTaskId()) return;
    const owning = this.timeEntries().find((one) => one.id === timeEntryId);
    this.timerBusyTaskId.set(owning?.task?.id ?? owning?.taskId ?? null);
    this.taskTimeEntryService.stopTimer(timeEntryId).subscribe({
      next: (timeEntry) => {
        this.timerBusyTaskId.set(null);
        this.refreshTimeEntries();
        this.messageService.addMessage({
          content: 'Timer stopped successfully',
          type: 'success',
        });
        // Get the task ID from the time entry (use taskId if task relation not populated)
        const taskIdToUpdate = timeEntry.task?.id || timeEntry.taskId;
        if (taskIdToUpdate) {
          this.taskService.getTaskById(taskIdToUpdate).subscribe({
            next: (updatedTask) => {
              // Update the task in the current project without reloading everything
              this.selectedProject.update((project) => {
                if (!project) return project;
                return {
                  ...project,
                  tasks: project.tasks.map((t) =>
                    t.id === taskIdToUpdate ? updatedTask : t
                  ),
                };
              });
            },
            error: (error) => {
              console.error('Error fetching updated task:', error);
              // Fallback to reloading the project
              this.loadProject(this.selectedProject()?.id || '');
            },
          });
        }
      },
      error: (error) => {
        this.timerBusyTaskId.set(null);
        console.error('Error stopping timer:', error);
        this.messageService.addMessage({
          content:
            'Error stopping timer: ' + (error.message || 'Unknown error'),
          type: 'error',
        });
      },
    });
  }
}
