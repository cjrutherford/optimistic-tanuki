import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ProjectsComponent } from './projects.component';
import { ProjectService } from '../../project/project.service';
import { TaskService } from '../../task/task.service';
import { RiskService } from '../../risk/risk.service';
import { ChangeService } from '../../change/change.service';
import { JournalService } from '../../journal/journal.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { Project, Task, Risk, Change, ProjectJournal, CreateTask, CreateRisk, CreateChange, CreateProjectJournal, CreateProject } from '@optimistic-tanuki/ui-models';

describe('ProjectsComponent', () => {
  let component: ProjectsComponent;
  let fixture: ComponentFixture<ProjectsComponent>;
  let projectService: ProjectService;
  let taskService: TaskService;
  let riskService: RiskService;
  let changeService: ChangeService;
  let journalService: JournalService;
  let messageService: MessageService;

  const mockProject: Project = {
    id: '1', name: 'Test Project', description: '', owner: 'owner1', createdBy: 'creator1', createdAt: new Date(), updatedAt: new Date(),
    members: [], startDate: new Date(), endDate: new Date(), status: 'IN_PROGRESS',
    timers: [], tasks: [], risks: [], changes: [], journalEntries: [],
  };

  const mockTask: Task = { id: 'task1', title: 'Task 1', description: '', projectId: '1', status: 'TODO', priority: 'MEDIUM', createdBy: 'creator1', createdAt: new Date(), updatedAt: new Date(), assignee: 'assignee1', dueDate: new Date() };
  const mockRisk: Risk = { id: 'risk1', description: 'Risk 1', projectId: '1', impact: 'LOW', likelihood: 'UNLIKELY', status: 'OPEN', riskOwner: 'owner1', createdBy: 'creator1', createdAt: new Date(), updatedAt: new Date() };
  const mockChange: Change = { id: 'change1', changeDate: new Date(), projectId: '1', changeType: 'ADDITION', changeStatus: 'PENDING', changeDescription: '', requestor: '', resolution: 'PENDING', updatedAt: new Date() };
  const mockJournal: ProjectJournal = { id: 'journal1', content: 'Journal 1', projectId: '1', profileId: 'profile1', createdAt: new Date(), updatedAt: new Date() };

  beforeEach(async () => {
    const projectServiceMock = {
      getProjects: jest.fn().mockReturnValue(of([mockProject])),
      createProject: jest.fn().mockReturnValue(of(mockProject)),
      updateProject: jest.fn().mockReturnValue(of(mockProject)),
    };
    const taskServiceMock = {
        createTask: jest.fn().mockReturnValue(of(mockTask)),
        updateTask: jest.fn().mockReturnValue(of(mockTask)),
        deleteTask: jest.fn().mockReturnValue(of(undefined))
    };
    const riskServiceMock = {
        createRisk: jest.fn().mockReturnValue(of(mockRisk)),
        updateRisk: jest.fn().mockReturnValue(of(mockRisk)),
        deleteRisk: jest.fn().mockReturnValue(of(undefined))
    };
    const changeServiceMock = {
        createChange: jest.fn().mockReturnValue(of(mockChange)),
        updateChange: jest.fn().mockReturnValue(of(mockChange)),
        deleteChange: jest.fn().mockReturnValue(of(undefined))
    };
    const journalServiceMock = {
        createJournalEntry: jest.fn().mockReturnValue(of(mockJournal)),
        updateJournalEntry: jest.fn().mockReturnValue(of(mockJournal)),
        deleteJournalEntry: jest.fn().mockReturnValue(of(undefined))
    };
    const messageServiceMock = { addMessage: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [ProjectsComponent],
      providers: [
        { provide: ProjectService, useValue: projectServiceMock },
        { provide: TaskService, useValue: taskServiceMock },
        { provide: RiskService, useValue: riskServiceMock },
        { provide: ChangeService, useValue: changeServiceMock },
        { provide: JournalService, useValue: journalServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectsComponent);
    component = fixture.componentInstance;
    projectService = TestBed.inject(ProjectService);
    taskService = TestBed.inject(TaskService);
    riskService = TestBed.inject(RiskService);
    changeService = TestBed.inject(ChangeService);
    journalService = TestBed.inject(JournalService);
    messageService = TestBed.inject(MessageService);
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

  it('should handle project selection', () => {
    const newProject = { ...mockProject, id: '2' };
    component.projects.set([mockProject, newProject]);
    component.onProjectSelected('2');
    expect(component.selectedProject()).toEqual(newProject);
  });

  it('should open create modal', () => {
    component.onCreateProject();
    expect(component.showCreateModal()).toBe(true);
  });

  it('should handle creating a project', fakeAsync(() => {
    const createProjectDto: CreateProject = { name: 'New Project', description: '', owner: '', createdBy: '', members: [], status: 'IN_PROGRESS', startDate: new Date() };
    component.onProjectCreated(createProjectDto);
    tick();
    expect(projectService.createProject).toHaveBeenCalledWith(createProjectDto);
    expect(messageService.addMessage).toHaveBeenCalledWith({ content: 'New project created successfully', type: 'success' });
    expect(component.showCreateModal()).toBe(false);
  }));

  it('should handle creating a task', fakeAsync(() => {
    component.selectedProject.set(mockProject);
    const createTaskDto: CreateTask = { title: 'New Task', description: '', projectId: '', status: 'TODO', priority: 'MEDIUM', createdBy: '' };
    component.onCreateTask(createTaskDto);
    tick();
    expect(taskService.createTask).toHaveBeenCalledWith({ ...createTaskDto, projectId: mockProject.id });
    expect(messageService.addMessage).toHaveBeenCalledWith({ content: 'Task created successfully', type: 'success' });
    expect(component.selectedProject()?.tasks).toContainEqual(mockTask);
  }));

  it('should handle creating a risk', fakeAsync(() => {
    component.selectedProject.set(mockProject);
    const createRiskDto: CreateRisk = { description: 'New Risk' , projectId: '', impact: 'LOW', likelihood: 'UNLIKELY', status: 'OPEN', riskOwner: '', createdBy: ''};
    component.onCreateRisk(createRiskDto);
    tick();
    expect(riskService.createRisk).toHaveBeenCalledWith({ ...createRiskDto, projectId: mockProject.id });
    expect(messageService.addMessage).toHaveBeenCalledWith({ content: 'Risk created successfully', type: 'success' });
    expect(component.selectedProject()?.risks).toContainEqual(mockRisk);
  }));

  it('should handle creating a change', fakeAsync(() => {
    component.selectedProject.set(mockProject);
    const createChangeDto: CreateChange = { changeDate: new Date(), projectId: '', changeType: 'ADDITION', changeStatus: 'PENDING', changeDescription: '', requestor: '', resolution: 'PENDING' };
    component.onCreateChange(createChangeDto);
    tick();
    expect(changeService.createChange).toHaveBeenCalledWith({ ...createChangeDto, projectId: mockProject.id });
    expect(messageService.addMessage).toHaveBeenCalledWith({ content: 'Change created successfully', type: 'success' });
    expect(component.selectedProject()?.changes).toContainEqual(mockChange);
  }));

  it('should handle creating a journal entry', fakeAsync(() => {
    component.selectedProject.set(mockProject);
    const createJournalDto: CreateProjectJournal = { content: 'New Entry', projectId: '', profileId: '', createdAt: new Date() };
    component.onCreateJournalEntry(createJournalDto);
    tick();
    expect(journalService.createJournalEntry).toHaveBeenCalledWith({ ...createJournalDto, projectId: mockProject.id, profileId: mockProject.owner });
    expect(messageService.addMessage).toHaveBeenCalledWith({ content: 'Journal entry created successfully', type: 'success' });
    expect(component.selectedProject()?.journalEntries).toContainEqual(mockJournal);
  }));

  it('should handle deleting a task', fakeAsync(() => {
    component.selectedProject.set({ ...mockProject, tasks: [mockTask] });
    component.onDeleteTask(mockTask.id);
    tick();
    expect(taskService.deleteTask).toHaveBeenCalledWith(mockTask.id);
    expect(messageService.addMessage).toHaveBeenCalledWith({ content: 'Task deleted successfully', type: 'success' });
    expect(component.selectedProject()?.tasks).not.toContainEqual(mockTask);
  }));

  it('should handle editing a task', fakeAsync(() => {
    const initialTask: Task = { ...mockTask, title: 'Original Title' };
    component.selectedProject.set({ ...mockProject, tasks: [initialTask] });

    const updatedTask: Task = { ...initialTask, title: 'Updated Task' };
    taskService.updateTask.mockReturnValue(of(updatedTask));

    component.onEditTask(updatedTask);
    tick();

    expect(taskService.updateTask).toHaveBeenCalledWith(updatedTask);
    expect(messageService.addMessage).toHaveBeenCalledWith({ content: 'Task updated successfully', type: 'success' });
    expect(component.selectedProject()?.tasks).toEqual([updatedTask]);
  }));

  it('should handle editing a risk', fakeAsync(() => {
    const initialRisk: Risk = { ...mockRisk, description: 'Original Risk' };
    component.selectedProject.set({ ...mockProject, risks: [initialRisk] });

    const updatedRisk: Risk = { ...initialRisk, description: 'Updated Risk' };
    riskService.updateRisk.mockReturnValue(of(updatedRisk));

    component.onEditRisk(updatedRisk);
    tick();

    expect(riskService.updateRisk).toHaveBeenCalledWith(updatedRisk.id, updatedRisk);
    expect(messageService.addMessage).toHaveBeenCalledWith({ content: 'Risk updated successfully', type: 'success' });
    expect(component.selectedProject()?.risks).toEqual([updatedRisk]);
  }));

  it('should handle deleting a risk', fakeAsync(() => {
    component.selectedProject.set({ ...mockProject, risks: [mockRisk] });
    component.onDeleteRisk(mockRisk.id);
    tick();
    expect(riskService.deleteRisk).toHaveBeenCalledWith(mockRisk.id);
    expect(messageService.addMessage).toHaveBeenCalledWith({ content: 'Risk deleted successfully', type: 'success' });
    expect(component.selectedProject()?.risks).not.toContainEqual(mockRisk);
  }));

  it('should handle editing a change', fakeAsync(() => {
    const initialChange: Change = { ...mockChange, changeDescription: 'Original Change' };
    component.selectedProject.set({ ...mockProject, changes: [initialChange] });

    const updatedChange: Change = { ...initialChange, changeDescription: 'Updated Change' };
    changeService.updateChange.mockReturnValue(of(updatedChange));

    component.onEditChange(updatedChange);
    tick();

    expect(changeService.updateChange).toHaveBeenCalledWith(updatedChange);
    expect(messageService.addMessage).toHaveBeenCalledWith({ content: 'Change updated successfully', type: 'success' });
    expect(component.selectedProject()?.changes).toEqual([updatedChange]);
  }));

  it('should handle deleting a change', fakeAsync(() => {
    component.selectedProject.set({ ...mockProject, changes: [mockChange] });
    component.onDeleteChange(mockChange.id);
    tick();
    expect(changeService.deleteChange).toHaveBeenCalledWith(mockChange.id);
    expect(messageService.addMessage).toHaveBeenCalledWith({ content: 'Change deleted successfully', type: 'success' });
    expect(component.selectedProject()?.changes).not.toContainEqual(mockChange);
  }));

  it('should handle updating a journal entry', fakeAsync(() => {
    const initialJournal: ProjectJournal = { ...mockJournal, content: 'Original Journal' };
    component.selectedProject.set({ ...mockProject, journalEntries: [initialJournal] });

    const updatedJournal: ProjectJournal = { ...initialJournal, content: 'Updated Journal' };
    journalService.updateJournalEntry.mockReturnValue(of(updatedJournal));

    component.onUpdateJournalEntry(updatedJournal);
    tick();

    expect(journalService.updateJournalEntry).toHaveBeenCalledWith(updatedJournal);
    expect(messageService.addMessage).toHaveBeenCalledWith({ content: 'Journal entry updated successfully', type: 'success' });
    expect(component.selectedProject()?.journalEntries).toEqual([updatedJournal]);
  }));

  it('should handle deleting a journal entry', fakeAsync(() => {
    component.selectedProject.set({ ...mockProject, journalEntries: [mockJournal] });
    component.onDeleteJournalEntry(mockJournal.id);
    tick();
    expect(journalService.deleteJournalEntry).toHaveBeenCalledWith(mockJournal.id);
    expect(messageService.addMessage).toHaveBeenCalledWith({ content: 'Journal entry deleted successfully', type: 'success' });
    expect(component.selectedProject()?.journalEntries).not.toContainEqual(mockJournal);
  }));

  it('should show details', () => {
    component.selectedProject.set(mockProject);
    component.showDetails('tasks');
    expect(component.detailsShown()).toBe(true);
    expect(component.shownDetails()).toBe('tasks');
  });

  it('should hide details', () => {
    component.hideDetails();
    expect(component.detailsShown()).toBe(false);
    expect(component.shownDetails()).toBe('tasks');
  });

  it('should calculate task count correctly', () => {
    const projectWithTasks = { ...mockProject, tasks: [{ status: 'TODO' }, { status: 'DONE' }, { status: 'IN_PROGRESS' }] as Task[] };
    component.selectedProject.set(projectWithTasks);
    expect(component.taskCount()).toBe(2);
  });

  it('should calculate risk count correctly', () => {
    const projectWithRisks = { ...mockProject, risks: [{ status: 'OPEN' }, { status: 'CLOSED' }, { status: 'MITIGATED' }] as Risk[] };
    component.selectedProject.set(projectWithRisks);
    expect(component.riskCount()).toBe(2);
  });

  it('should calculate change count correctly', () => {
    const projectWithChanges = { ...mockProject, changes: [{ changeStatus: 'PENDING' }, { changeStatus: 'COMPLETE' }, { changeStatus: 'IN_PROGRESS' }] as Change[] };
    component.selectedProject.set(projectWithChanges);
    expect(component.changeCount()).toBe(2);
  });
});