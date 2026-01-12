import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TaskKanbanComponent } from './task-kanban.component';

describe('TaskKanbanComponent', () => {
  let component: TaskKanbanComponent;
  let fixture: ComponentFixture<TaskKanbanComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskKanbanComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskKanbanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have four kanban columns', () => {
    expect(component.columns().length).toBe(4);
    expect(component.columns()[0].status).toBe('TODO');
    expect(component.columns()[1].status).toBe('IN_PROGRESS');
    expect(component.columns()[2].status).toBe('DONE');
    expect(component.columns()[3].status).toBe('ARCHIVED');
  });

  it('should update columns when tasks change', () => {
    const mockTasks = [
      {
        id: '1',
        title: 'Test Task',
        description: 'Test Description',
        status: 'TODO' as const,
        priority: 'HIGH' as const,
        assignee: 'test@example.com',
        projectId: 'project-1',
        dueDate: new Date('2024-12-31'),
        createdBy: 'admin',
        createdAt: new Date(),
      },
    ];

    component.tasks = mockTasks;
    component.ngOnChanges({
      tasks: {
        currentValue: mockTasks,
        previousValue: [],
        firstChange: false,
        isFirstChange: () => false,
      },
    });

    const todoColumn = component.columns().find(c => c.status === 'TODO');
    expect(todoColumn?.tasks.length).toBe(1);
  });
});
