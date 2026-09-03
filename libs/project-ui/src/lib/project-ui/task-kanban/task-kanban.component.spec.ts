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

    const todoColumn = component.columns().find((c) => c.status === 'TODO');
    expect(todoColumn?.tasks.length).toBe(1);
  });
});

/**
 * Dropping a card in another column has to move it there.
 *
 * The handler emitted the status change and left the arrays behind the columns
 * untouched, so the card sprang back to where it came from and only arrived
 * once the server answered and the parent replaced the whole task list.
 * Watching a drop bounce back reads as the drop having failed.
 */
describe('TaskKanbanComponent dropping between columns', () => {
  let component: TaskKanbanComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskKanbanComponent],
    }).compileComponents();
    component = TestBed.createComponent(TaskKanbanComponent).componentInstance;
  });

  function drop() {
    const todo = [{ id: 't1', status: 'TODO' }];
    const doing: unknown[] = [];
    const emitted: unknown[] = [];
    component.editTask.subscribe((task: unknown) => emitted.push(task));

    component.drop(
      {
        previousContainer: { data: todo },
        container: { data: doing },
        previousIndex: 0,
        currentIndex: 0,
      } as never,
      { status: 'IN_PROGRESS' } as never
    );

    return { todo, doing, emitted };
  }

  it('moves the card into the column it was dropped in', () => {
    const { todo, doing } = drop();

    expect(todo).toHaveLength(0);
    expect(doing).toHaveLength(1);
  });

  it('still tells the parent, which remains the authority', () => {
    // The move is a prediction. The parent rebuilds these columns from its own
    // tasks when the update lands and is free to overrule it.
    const { emitted } = drop();

    expect(emitted).toEqual([{ id: 't1', status: 'IN_PROGRESS' }]);
  });
});
