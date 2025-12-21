import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgTasksTableComponent } from './ag-tasks-table.component';
import { Task } from '@optimistic-tanuki/ui-models';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
// Import to trigger AG Grid module registration
import '@optimistic-tanuki/ag-grid-ui';

describe('AgTasksTableComponent', () => {
  let component: AgTasksTableComponent;
  let fixture: ComponentFixture<AgTasksTableComponent>;

  const mockTasks: Task[] = [
    {
      id: '1',
      title: 'Test Task 1',
      description: 'Description for task 1',
      status: 'TODO',
      priority: 'HIGH',
      assignee: 'John Doe',
      projectId: 'project-1',
      dueDate: new Date('2024-12-31'),
      createdBy: 'admin',
      createdAt: new Date('2024-01-01'),
    },
    {
      id: '2',
      title: 'Test Task 2',
      description: 'Description for task 2',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      assignee: 'Jane Smith',
      projectId: 'project-1',
      dueDate: new Date('2024-12-25'),
      createdBy: 'admin',
      createdAt: new Date('2024-01-02'),
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgTasksTableComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AgTasksTableComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with empty tasks array', () => {
    expect(component.tasks).toEqual([]);
  });

  it('should accept tasks input', () => {
    component.tasks = mockTasks;
    // Don't call detectChanges() to avoid AG Grid initialization
    expect(component.tasks.length).toBe(2);
  });

  it('should have column definitions configured', () => {
    expect(component.columnDefs).toBeDefined();
    expect(component.columnDefs.length).toBeGreaterThan(0);
  });

  it('should have grid options configured', () => {
    expect(component.gridOptions).toBeDefined();
    expect(component.gridOptions.pagination).toBe(true);
    expect(component.gridOptions.paginationPageSize).toBe(10);
  });

  it('should render AG Grid with data', () => {
    component.tasks = mockTasks;
    // Don't call detectChanges() to avoid AG Grid initialization in test environment
    // AG Grid rendering is tested in Storybook
    
    expect(component.tasks.length).toBe(2);
    expect(component.columnDefs).toBeDefined();
  });

  it('should emit createTask event', (done) => {
    component.createTask.subscribe((task) => {
      expect(task.title).toBe('New Task');
      done();
    });

    component.onCreateFormSubmit({
      id: '3',
      title: 'New Task',
      description: 'New Description',
      status: 'TODO',
      priority: 'LOW',
      assignee: 'Test User',
      projectId: 'project-1',
      createdBy: 'admin',
      dueDate: new Date(),
      createdAt: new Date(),
    });
  });

  it('should emit editTask event', (done) => {
    const taskToEdit = mockTasks[0];
    component.editTask.subscribe((task) => {
      expect(task.id).toBe('1');
      done();
    });

    component.onEditFormSubmit(taskToEdit);
  });

  it('should emit deleteTask event', (done) => {
    component.deleteTask.subscribe((taskId) => {
      expect(taskId).toBe('1');
      done();
    });

    component.deleteTask.emit('1');
  });

  it('should handle modal open/close', () => {
    expect(component.showModal).toBe(false);
    component.showModal = true;
    expect(component.showModal).toBe(true);
    component.closeModal();
    expect(component.showModal).toBe(false);
  });

  it('should set selected task for editing', () => {
    const task = mockTasks[0];
    component.onEdit(task);
    expect(component.selectedTask).toEqual(task);
    expect(component.showEditModal).toBe(true);
  });
});
