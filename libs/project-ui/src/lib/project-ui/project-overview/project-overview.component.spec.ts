import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectOverviewComponent } from './project-overview.component';
import { Project } from '@optimistic-tanuki/ui-models';

describe('ProjectOverviewComponent', () => {
  let component: ProjectOverviewComponent;
  let fixture: ComponentFixture<ProjectOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectOverviewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize project name from input', () => {
    const testProject: Project = {
      id: '1',
      name: 'Test Project',
      owner: 'John Doe',
      members: [],
      createdBy: 'John Doe',
      createdAt: new Date(),
      description: '',
      startDate: new Date(),
      endDate: new Date(),
      status: 'active',
      tasks: [],
      risks: [],
      changes: [],
      journalEntries: [],
      timers: [],
    };
    component.project = testProject;
    component.ngOnInit();
    expect(component.projectName()).toBe('Test Project');
  });

  it('should calculate task count correctly', () => {
    const testProject: Project = {
      id: '1',
      name: 'Test Project',
      owner: 'John Doe',
      members: [],
      createdBy: 'John Doe',
      createdAt: new Date(),
      description: '',
      startDate: new Date(),
      endDate: new Date(),
      status: 'active',
      tasks: [
        { id: '1', projectId: '1', title: 'Task 1', description: 'Desc 1', status: 'TODO', priority: 'HIGH', assignee: 'user1', dueDate: new Date(), createdBy: 'user', createdAt: new Date() },
        { id: '2', projectId: '1', title: 'Task 2', description: 'Desc 2', status: 'IN_PROGRESS', priority: 'MEDIUM', assignee: 'user2', dueDate: new Date(), createdBy: 'user', createdAt: new Date() },
        { id: '3', projectId: '1', title: 'Task 3', description: 'Desc 3', status: 'DONE', priority: 'LOW', assignee: 'user3', dueDate: new Date(), createdBy: 'user', createdAt: new Date() },
      ],
      risks: [],
      changes: [],
      journalEntries: [],
      timers: [],
    };
    component.project = testProject;
    component.ngOnInit();
    expect(component.taskCount()).toBe(2);
  });

  it('should calculate risk count correctly', () => {
    const testProject: Project = {
      id: '1',
      name: 'Test Project',
      owner: 'John Doe',
      members: [],
      createdBy: 'John Doe',
      createdAt: new Date(),
      description: '',
      startDate: new Date(),
      endDate: new Date(),
      status: 'active',
      tasks: [],
      risks: [
        { id: '1', projectId: '1', description: 'Risk 1', status: 'OPEN', impact: 'HIGH', likelihood: 'LIKELY', createdBy: 'user', createdAt: new Date(), resolution: 'PENDING' },
        { id: '2', projectId: '1', description: 'Risk 2', status: 'IN_PROGRESS', impact: 'MEDIUM', likelihood: 'POSSIBLE', createdBy: 'user', createdAt: new Date(), resolution: 'PENDING' },
        { id: '3', projectId: '1', description: 'Risk 3', status: 'CLOSED', impact: 'LOW', likelihood: 'UNLIKELY', createdBy: 'user', createdAt: new Date(), resolution: 'PENDING' },
      ],
      changes: [],
      journalEntries: [],
      timers: [],
    };
    component.project = testProject;
    component.ngOnInit();
    expect(component.riskCount()).toBe(2);
  });

  it('should calculate change count correctly', () => {
    const testProject: Project = {
      id: '1',
      name: 'Test Project',
      owner: 'John Doe',
      members: [],
      createdBy: 'John Doe',
      createdAt: new Date(),
      description: '',
      startDate: new Date(),
      endDate: new Date(),
      status: 'active',
      tasks: [],
      risks: [],
      changes: [
        { id: '1', projectId: '1', changeType: 'ADDITION', changeDescription: 'Change 1', changeStatus: 'PENDING', changeDate: new Date(), requestor: 'user', resolution: 'PENDING' },
        { id: '2', projectId: '1', changeType: 'MODIFICATION', changeDescription: 'Change 2', changeStatus: 'PENDING_APPROVAL', changeDate: new Date(), requestor: 'user', resolution: 'PENDING' },
        { id: '3', projectId: '1', changeType: 'DELETION', changeDescription: 'Change 3', changeStatus: 'COMPLETE', changeDate: new Date(), requestor: 'user', resolution: 'APPROVED' },
      ],
      journalEntries: [],
      timers: [],
    };
    component.project = testProject;
    component.ngOnInit();
    expect(component.changeCount()).toBe(2);
  });

  it('should show details and set shownDetails', () => {
    component.showDetails('risks');
    expect(component.detailsShown()).toBe(true);
    expect(component.shownDetails()).toBe('risks');
  });

  it('should hide details and reset shownDetails', () => {
    component.showDetails('risks'); // First show details to then hide them
    component.hideDetails();
    expect(component.detailsShown()).toBe(false);
    expect(component.shownDetails()).toBe('tasks');
  });
});
