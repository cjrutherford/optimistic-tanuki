import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ProjectsComponent } from './projects.component';
import { ProjectService } from '../../project/project.service';
import { TaskService } from '../../task/task.service';
import { RiskService } from '../../risk/risk.service';
import { ChangeService } from '../../change/change.service';
import { JournalService } from '../../journal/journal.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { TaskTimeEntryService } from '../../task-time-entry/task-time-entry.service';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import {
  Project,
  Task,
  Risk,
  Change,
  ProjectJournal,
  CreateTask,
  CreateRisk,
  CreateChange,
  CreateProjectJournal,
  CreateProject,
} from '@optimistic-tanuki/ui-models';

describe('ProjectsComponent', () => {
  let component: ProjectsComponent;
  let fixture: ComponentFixture<ProjectsComponent>;
  let projectService: jest.Mocked<ProjectService>;
  let taskService: jest.Mocked<TaskService>;
  let riskService: jest.Mocked<RiskService>;
  let changeService: jest.Mocked<ChangeService>;
  let journalService: jest.Mocked<JournalService>;
  let messageService: jest.Mocked<MessageService>;
  let taskTimeEntryService: jest.Mocked<TaskTimeEntryService>;
  let themeService: jest.Mocked<ThemeService>;

  const mockProject: Project = {
    id: '1',
    name: 'Test Project',
    description: '',
    owner: 'owner1',
    createdBy: 'creator1',
    createdAt: new Date(),
    updatedAt: new Date(),
    members: [],
    startDate: new Date(),
    endDate: new Date(),
    status: 'IN_PROGRESS',
    timers: [],
    tasks: [],
    risks: [],
    changes: [],
    journalEntries: [],
  };

  const mockTask: Task = {
    id: 'task1',
    title: 'Task 1',
    description: '',
    projectId: '1',
    status: 'TODO',
    priority: 'MEDIUM',
    createdBy: 'creator1',
    createdAt: new Date(),
    updatedAt: new Date(),
    assignee: 'assignee1',
    dueDate: new Date(),
  };
  const mockRisk: Risk = {
    id: 'risk1',
    description: 'Risk 1',
    projectId: '1',
    impact: 'LOW',
    likelihood: 'UNLIKELY',
    status: 'OPEN',
    riskOwner: 'owner1',
    createdBy: 'creator1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const mockChange: Change = {
    id: 'change1',
    changeDate: new Date(),
    projectId: '1',
    changeType: 'ADDITION',
    changeStatus: 'PENDING',
    changeDescription: '',
    requestor: '',
    resolution: 'PENDING',
    updatedAt: new Date(),
  };
  const mockJournal: ProjectJournal = {
    id: 'journal1',
    content: 'Journal 1',
    projectId: '1',
    profileId: 'profile1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const projectServiceMock = {
      getProjects: jest.fn().mockReturnValue(of([mockProject])),
      createProject: jest.fn().mockReturnValue(of(mockProject)),
      updateProject: jest.fn().mockReturnValue(of(mockProject)),
      getProjectById: jest.fn().mockReturnValue(of(mockProject)),
      deleteProject: jest.fn().mockReturnValue(of(undefined)),
    };
    const taskServiceMock = {
      createTask: jest.fn().mockReturnValue(of(mockTask)),
      updateTask: jest.fn().mockReturnValue(of(mockTask)),
      deleteTask: jest.fn().mockReturnValue(of(undefined)),
      getTaskById: jest.fn().mockReturnValue(of(mockTask)),
    };
    const riskServiceMock = {
      createRisk: jest.fn().mockReturnValue(of(mockRisk)),
      updateRisk: jest.fn().mockReturnValue(of(mockRisk)),
      deleteRisk: jest.fn().mockReturnValue(of(undefined)),
    };
    const changeServiceMock = {
      createChange: jest.fn().mockReturnValue(of(mockChange)),
      updateChange: jest.fn().mockReturnValue(of(mockChange)),
      deleteChange: jest.fn().mockReturnValue(of(undefined)),
    };
    const journalServiceMock = {
      createJournalEntry: jest.fn().mockReturnValue(of(mockJournal)),
      updateJournalEntry: jest.fn().mockReturnValue(of(mockJournal)),
      deleteJournalEntry: jest.fn().mockReturnValue(of(undefined)),
    };
    const messageServiceMock = { addMessage: jest.fn() };
    const taskTimeEntryServiceMock = {
      startTimer: jest
        .fn()
        .mockReturnValue(of({ id: 'time1', taskId: 'task1' })),
      stopTimer: jest
        .fn()
        .mockReturnValue(of({ id: 'time1', taskId: 'task1' })),
    };
    const themeServiceMock = {
      getTheme: jest.fn().mockReturnValue('light'),
      themeColors$: of({
        background: '#fff',
        foreground: '#000',
        accent: '#00f',
      }),
      getCurrentPersonality: jest.fn().mockReturnValue(undefined),
      personality$: of(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [ProjectsComponent],
      providers: [
        { provide: ProjectService, useValue: projectServiceMock },
        { provide: TaskService, useValue: taskServiceMock },
        { provide: RiskService, useValue: riskServiceMock },
        { provide: ChangeService, useValue: changeServiceMock },
        { provide: JournalService, useValue: journalServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: TaskTimeEntryService, useValue: taskTimeEntryServiceMock },
        { provide: ThemeService, useValue: themeServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectsComponent);
    component = fixture.componentInstance;
    projectService = TestBed.inject(
      ProjectService
    ) as jest.Mocked<ProjectService>;
    taskService = TestBed.inject(TaskService) as jest.Mocked<TaskService>;
    riskService = TestBed.inject(RiskService) as jest.Mocked<RiskService>;
    changeService = TestBed.inject(ChangeService) as jest.Mocked<ChangeService>;
    journalService = TestBed.inject(
      JournalService
    ) as jest.Mocked<JournalService>;
    messageService = TestBed.inject(
      MessageService
    ) as jest.Mocked<MessageService>;
    taskTimeEntryService = TestBed.inject(
      TaskTimeEntryService
    ) as jest.Mocked<TaskTimeEntryService>;
    themeService = TestBed.inject(ThemeService) as jest.Mocked<ThemeService>;
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load projects on init', fakeAsync(() => {
    component.ngOnInit();
    tick();
    expect(projectService.getProjects).toHaveBeenCalled();
    expect(component.projects().length).toBe(1);
    expect(component.selectedProject()).toEqual(mockProject);
  }));

  it('should handle project loading error', fakeAsync(() => {
    projectService.getProjects.mockReturnValue(
      throwError(() => new Error('Failed'))
    );
    (component as any).loadProjects();
    tick();
    expect(messageService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' })
    );
  }));

  it('should handle project selection', () => {
    const newProject = { ...mockProject, id: '2' };
    component.projects.set([mockProject, newProject]);
    component.onProjectSelected('2');
    expect(component.selectedProject()).toEqual(newProject);
  });

  it('should handle setTaskViewMode', () => {
    component.setTaskViewMode('calendar');
    expect(component.taskViewMode()).toBe('calendar');
  });

  it('should open modals', () => {
    component.onCreateProject();
    expect(component.showCreateModal()).toBe(true);
    component.onEditProject(mockProject);
    expect(component.showEditModal()).toBe(true);
    component.onDeleteProject();
    expect(component.showDeleteModal()).toBe(true);
  });

  it('should handle project creation', fakeAsync(() => {
    const createProjectDto: CreateProject = {
      name: 'New',
      description: '',
      owner: '',
      createdBy: '',
      members: [],
      status: 'IN_PROGRESS',
      startDate: new Date(),
    };
    component.onProjectCreated(createProjectDto);
    tick();
    expect(projectService.createProject).toHaveBeenCalled();
    expect(component.showCreateModal()).toBe(false);
    expect(component.projects()).toContainEqual(mockProject);
  }));

  it('should handle project update', fakeAsync(() => {
    component.selectedProject.set(mockProject);
    component.onProjectUpdated({ name: 'Updated' } as any);
    tick();
    expect(projectService.updateProject).toHaveBeenCalled();
    expect(component.showEditModal()).toBe(false);
  }));

  it('should handle creating a task', fakeAsync(() => {
    component.selectedProject.set(mockProject);
    component.onCreateTask({ title: 'New' } as any);
    tick();
    expect(taskService.createTask).toHaveBeenCalled();
    expect(component.selectedProject()?.tasks).toContainEqual(mockTask);
  }));

  it('should handle creating a risk', fakeAsync(() => {
    component.selectedProject.set(mockProject);
    component.onCreateRisk({ description: 'New' } as any);
    tick();
    expect(riskService.createRisk).toHaveBeenCalled();
    expect(component.selectedProject()?.risks).toContainEqual(mockRisk);
  }));

  it('should handle editing a risk', fakeAsync(() => {
    component.selectedProject.set({ ...mockProject, risks: [mockRisk] });
    const updatedRisk = { ...mockRisk, description: 'Updated' };
    riskService.updateRisk.mockReturnValue(of(updatedRisk));
    component.onEditRisk(updatedRisk);
    tick();
    expect(riskService.updateRisk).toHaveBeenCalled();
    expect(component.selectedProject()?.risks).toContainEqual(updatedRisk);
  }));

  it('should handle creating a change', fakeAsync(() => {
    component.selectedProject.set(mockProject);
    component.onCreateChange({ changeDescription: 'New' } as any);
    tick();
    expect(changeService.createChange).toHaveBeenCalled();
    expect(component.selectedProject()?.changes).toContainEqual(mockChange);
  }));

  it('should handle editing a change', fakeAsync(() => {
    component.selectedProject.set({ ...mockProject, changes: [mockChange] });
    const updatedChange = { ...mockChange, changeDescription: 'Updated' };
    changeService.updateChange.mockReturnValue(of(updatedChange));
    component.onEditChange(updatedChange);
    tick();
    expect(changeService.updateChange).toHaveBeenCalled();
    expect(component.selectedProject()?.changes).toContainEqual(updatedChange);
  }));

  it('should handle deleting a change', fakeAsync(() => {
    component.selectedProject.set({ ...mockProject, changes: [mockChange] });
    component.onDeleteChange('change1');
    tick();
    expect(changeService.deleteChange).toHaveBeenCalled();
    expect(component.selectedProject()?.changes.length).toBe(0);
  }));

  it('should handle creating a journal entry', fakeAsync(() => {
    component.selectedProject.set(mockProject);
    component.onCreateJournalEntry({ content: 'New' } as any);
    tick();
    expect(journalService.createJournalEntry).toHaveBeenCalled();
    expect(component.selectedProject()?.journalEntries).toContainEqual(
      mockJournal
    );
  }));

  it('should handle updating a journal entry', fakeAsync(() => {
    component.selectedProject.set({
      ...mockProject,
      journalEntries: [mockJournal],
    });
    const updatedJournal = { ...mockJournal, content: 'Updated' };
    journalService.updateJournalEntry.mockReturnValue(of(updatedJournal));
    component.onUpdateJournalEntry(updatedJournal);
    tick();
    expect(journalService.updateJournalEntry).toHaveBeenCalled();
    expect(component.selectedProject()?.journalEntries).toContainEqual(
      updatedJournal
    );
  }));

  it('should handle deleting a journal entry', fakeAsync(() => {
    component.selectedProject.set({
      ...mockProject,
      journalEntries: [mockJournal],
    });
    component.onDeleteJournalEntry('journal1');
    tick();
    expect(journalService.deleteJournalEntry).toHaveBeenCalled();
    expect(component.selectedProject()?.journalEntries.length).toBe(0);
  }));

  it('should handle showDetails and hideDetails', () => {
    component.projects.set([mockProject]);
    component.selectedProject.set(mockProject);
    component.showDetails('risks');
    expect(component.detailsShown()).toBe(true);
    expect(component.shownDetails()).toBe('risks');
    component.hideDetails();
    expect(component.detailsShown()).toBe(false);
  });

  it('should calculate counts', () => {
    component.selectedProject.set({
      ...mockProject,
      tasks: [mockTask],
      risks: [mockRisk],
      changes: [mockChange],
    });
    expect(component.taskCount()).toBe(1);
    expect(component.riskCount()).toBe(1);
    expect(component.changeCount()).toBe(1);
  });

  it('should handle task creation error', fakeAsync(() => {
    component.selectedProject.set(mockProject);
    taskService.createTask.mockReturnValue(throwError(() => new Error('Fail')));
    component.onCreateTask({} as any);
    tick();
    expect(messageService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' })
    );
  }));

  it('should handle editing a task', fakeAsync(() => {
    component.selectedProject.set({ ...mockProject, tasks: [mockTask] });
    component.onEditTask({ id: mockTask.id, title: 'Updated' } as any);
    tick();
    expect(taskService.updateTask).toHaveBeenCalled();
  }));

  it('should handle task edit error', fakeAsync(() => {
    taskService.updateTask.mockReturnValue(throwError(() => new Error('Fail')));
    component.onEditTask({ id: '1' } as any);
    tick();
    expect(messageService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' })
    );
  }));

  it('should handle deleting a task', fakeAsync(() => {
    component.selectedProject.set({ ...mockProject, tasks: [mockTask] });
    component.onDeleteTask(mockTask.id);
    tick();
    expect(taskService.deleteTask).toHaveBeenCalledWith(mockTask.id);
    expect(component.selectedProject()?.tasks.length).toBe(0);
  }));

  it('should handle task deletion error', fakeAsync(() => {
    taskService.deleteTask.mockReturnValue(throwError(() => new Error('Fail')));
    component.onDeleteTask('1');
    tick();
    expect(messageService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' })
    );
  }));

  it('should handle startTimer', fakeAsync(() => {
    component.selectedProject.set(mockProject);
    component.onStartTimer('task1');
    tick();
    expect(taskTimeEntryService.startTimer).toHaveBeenCalledWith('task1');
    expect(taskService.getTaskById).toHaveBeenCalledWith('task1');
  }));

  it('should handle startTimer error', fakeAsync(() => {
    taskTimeEntryService.startTimer.mockReturnValue(
      throwError(() => new Error('Fail'))
    );
    component.onStartTimer('task1');
    tick();
    expect(messageService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' })
    );
  }));

  it('should handle stopTimer', fakeAsync(() => {
    component.selectedProject.set(mockProject);
    const mockTimeEntry = {
      id: 'time1',
      taskId: 'task1',
      task: { id: 'task1' },
    };
    taskTimeEntryService.stopTimer.mockReturnValue(of(mockTimeEntry as any));
    component.onStopTimer('time1');
    tick();
    expect(taskTimeEntryService.stopTimer).toHaveBeenCalledWith('time1');
    expect(taskService.getTaskById).toHaveBeenCalledWith('task1');
  }));

  it('should handle stopTimer error', fakeAsync(() => {
    taskTimeEntryService.stopTimer.mockReturnValue(
      throwError(() => new Error('Fail'))
    );
    component.onStopTimer('time1');
    tick();
    expect(messageService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' })
    );
  }));

  it('should handle journal entry creation error', fakeAsync(() => {
    component.selectedProject.set(mockProject);
    journalService.createJournalEntry.mockReturnValue(
      throwError(() => new Error('Fail'))
    );
    component.onCreateJournalEntry({} as any);
    tick();
    expect(messageService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' })
    );
  }));

  it('should handle journal entry update error', fakeAsync(() => {
    journalService.updateJournalEntry.mockReturnValue(
      throwError(() => new Error('Fail'))
    );
    component.onUpdateJournalEntry({ id: '1' } as any);
    tick();
    expect(messageService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' })
    );
  }));

  it('should handle journal entry deletion error', fakeAsync(() => {
    journalService.deleteJournalEntry.mockReturnValue(
      throwError(() => new Error('Fail'))
    );
    component.onDeleteJournalEntry('1');
    tick();
    expect(messageService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' })
    );
  }));

  it('should handle risk creation error', fakeAsync(() => {
    component.selectedProject.set(mockProject);
    riskService.createRisk.mockReturnValue(throwError(() => new Error('Fail')));
    component.onCreateRisk({} as any);
    tick();
    expect(messageService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' })
    );
  }));

  it('should handle risk update error', fakeAsync(() => {
    riskService.updateRisk.mockReturnValue(throwError(() => new Error('Fail')));
    component.onEditRisk({ id: '1' } as any);
    tick();
    expect(messageService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' })
    );
  }));

  it('should handle risk deletion error', fakeAsync(() => {
    riskService.deleteRisk.mockReturnValue(throwError(() => new Error('Fail')));
    component.onDeleteRisk('1');
    tick();
    expect(messageService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' })
    );
  }));

  it('should handle change creation error', fakeAsync(() => {
    component.selectedProject.set(mockProject);
    changeService.createChange.mockReturnValue(
      throwError(() => new Error('Fail'))
    );
    component.onCreateChange({} as any);
    tick();
    expect(messageService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' })
    );
  }));

  it('should handle change update error', fakeAsync(() => {
    changeService.updateChange.mockReturnValue(
      throwError(() => new Error('Fail'))
    );
    component.onEditChange({ id: '1' } as any);
    tick();
    expect(messageService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' })
    );
  }));

  it('should handle change deletion error', fakeAsync(() => {
    changeService.deleteChange.mockReturnValue(
      throwError(() => new Error('Fail'))
    );
    component.onDeleteChange('1');
    tick();
    expect(messageService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' })
    );
  }));

  it('should handle loadProject', fakeAsync(() => {
    (component as any).loadProject('1');
    tick();
    expect(projectService.getProjectById).toHaveBeenCalledWith('1');
    expect(component.selectedProject()).toEqual(mockProject);
  }));

  it('should handle loadProject error', fakeAsync(() => {
    projectService.getProjectById.mockReturnValue(
      throwError(() => new Error('Fail'))
    );
    (component as any).loadProject('1');
    tick();
    expect(messageService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' })
    );
  }));
});
