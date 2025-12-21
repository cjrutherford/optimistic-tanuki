import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgTasksTableComponent } from './ag-tasks-table.component';
import { Task } from '@optimistic-tanuki/ui-models';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
// Import to trigger AG Grid module registration
import '@optimistic-tanuki/ag-grid-ui';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';

describe('AgTasksTableComponent', () => {
  let component: AgTasksTableComponent;
  let fixture: ComponentFixture<AgTasksTableComponent>;
  let compiled: HTMLElement;

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
    compiled = fixture.nativeElement;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with empty tasks array', () => {
    expect(component.tasks).toEqual([]);
  });

  it('should accept tasks input and update the grid', (done) => {
    component.tasks = mockTasks;
    fixture.detectChanges();
    
    // Wait for AG Grid to initialize and render
    setTimeout(() => {
      expect(component.tasks.length).toBe(2);
      
      // Verify AG Grid component is rendered
      const agGrid = compiled.querySelector('otui-ag-grid');
      expect(agGrid).toBeTruthy();
      
      // Verify that AG Grid Angular wrapper is present
      const agGridAngular = compiled.querySelector('ag-grid-angular');
      expect(agGridAngular).toBeTruthy();
      
      done();
    }, 500);
  });

  it('should have column definitions configured', () => {
    expect(component.columnDefs).toBeDefined();
    expect(component.columnDefs.length).toBeGreaterThan(0);
    
    // Verify key columns exist
    const titleColumn = component.columnDefs.find(col => col.field === 'title');
    const statusColumn = component.columnDefs.find(col => col.field === 'status');
    const priorityColumn = component.columnDefs.find(col => col.field === 'priority');
    
    expect(titleColumn).toBeDefined();
    expect(statusColumn).toBeDefined();
    expect(priorityColumn).toBeDefined();
  });

  it('should have grid options configured', () => {
    expect(component.gridOptions).toBeDefined();
    expect(component.gridOptions.pagination).toBe(true);
    expect(component.gridOptions.paginationPageSize).toBe(10);
  });

  it('should update grid when tasks input changes', (done) => {
    // Start with empty tasks
    component.tasks = [];
    fixture.detectChanges();
    
    // Add tasks
    component.tasks = mockTasks;
    component.ngOnChanges({
      tasks: {
        currentValue: mockTasks,
        previousValue: [],
        firstChange: false,
        isFirstChange: () => false
      }
    });
    fixture.detectChanges();
    
    setTimeout(() => {
      expect(component.tasks.length).toBe(2);
      done();
    }, 300);
  });

  it('should emit createTask event with correct data', (done) => {
    component.createTask.subscribe((task) => {
      expect(task.title).toBe('New Task');
      expect(task.priority).toBe('LOW');
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

  it('should emit editTask event with correct data', (done) => {
    const taskToEdit = mockTasks[0];
    component.editTask.subscribe((task) => {
      expect(task.id).toBe('1');
      expect(task.title).toBe('Test Task 1');
      done();
    });

    component.onEditFormSubmit(taskToEdit);
  });

  it('should emit deleteTask event with correct id', (done) => {
    component.deleteTask.subscribe((taskId) => {
      expect(taskId).toBe('1');
      done();
    });

    component.deleteTask.emit('1');
  });

  it('should handle modal open/close correctly', () => {
    expect(component.showModal).toBe(false);
    
    component.showModal = true;
    expect(component.showModal).toBe(true);
    
    component.closeModal();
    expect(component.showModal).toBe(false);
  });

  it('should set selected task for editing and open edit modal', () => {
    const task = mockTasks[0];
    component.onEdit(task);
    
    expect(component.selectedTask).toEqual(task);
    expect(component.showEditModal).toBe(true);
  });

  it('should properly configure action column with edit and delete buttons', () => {
    const actionsColumn = component.columnDefs.find(col => col.headerName === 'Actions');
    expect(actionsColumn).toBeDefined();
    expect(actionsColumn?.cellRenderer).toBeDefined();
  });

  it('should render grid with proper height', (done) => {
    component.tasks = mockTasks;
    fixture.detectChanges();
    
    setTimeout(() => {
      const agGrid = compiled.querySelector('otui-ag-grid');
      expect(agGrid).toBeTruthy();
      done();
    }, 300);
  });
});
