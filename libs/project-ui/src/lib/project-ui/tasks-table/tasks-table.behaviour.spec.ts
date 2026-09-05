import { SimpleChange } from '@angular/core';
import { Task } from '@optimistic-tanuki/ui-models';

import { TasksTableComponent } from './tasks-table.component';

/**
 * The component takes no dependencies, so it is exercised directly rather than
 * through TestBed — its template pulls in the table, modal and task-form
 * components, none of which this logic depends on.
 */
describe('TasksTableComponent behaviour', () => {
  let component: TasksTableComponent;

  const task = (overrides: Partial<Task> = {}): Task =>
    ({
      id: 'task-1',
      title: 'Write the spec',
      description: 'Cover the table',
      status: 'open',
      assignee: 'alice',
      createdBy: 'bob',
      priority: 'high',
      projectId: 'project-1',
      ...overrides,
    } as Task);

  beforeEach(() => {
    component = new TasksTableComponent();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('cell projection', () => {
    it('projects each task into its seven columns', () => {
      component.tasks = [task()];

      component.ngOnInit();

      const [row] = component.cells();
      expect(row.map((c) => c.heading)).toEqual([
        'Title',
        'Description',
        'Status',
        'Assignee',
        'Due Date',
        'Created By',
        'Created At',
      ]);
      // TableCell does not declare `id`, but the component stamps the task id
      // onto every cell so the table can key rows back to their task.
      expect(
        row.every((c) => (c as unknown as { id: string }).id === 'task-1')
      ).toBe(true);
      expect(row[0].value).toBe('Write the spec');
    });

    it.each([
      ['dueDate', 4],
      ['createdAt', 6],
    ])('shows N/A when %s is absent', (_field, column) => {
      component.tasks = [task()];

      component.ngOnInit();

      expect(component.cells()[0][column].value).toBe('N/A');
    });

    it('formats the dates it does have', () => {
      component.tasks = [
        task({
          dueDate: new Date('2026-03-01T10:00:00.000Z'),
          createdAt: new Date('2026-02-01T10:00:00.000Z'),
        } as Partial<Task>),
      ];

      component.ngOnInit();

      const row = component.cells()[0];
      expect(row[4].value).not.toBe('N/A');
      expect(row[6].value).not.toBe('N/A');
    });

    it('reprojects when the tasks input changes', () => {
      component.tasks = [task()];
      component.ngOnInit();

      component.tasks = [task({ id: 'task-2' }), task({ id: 'task-3' })];
      component.ngOnChanges({
        tasks: new SimpleChange([], component.tasks, false),
      });

      expect(component.cells()).toHaveLength(2);
    });

    it('leaves the cells alone for a change that is not tasks', () => {
      component.tasks = [task()];
      component.ngOnInit();
      const before = component.cells();

      component.ngOnChanges({
        somethingElse: new SimpleChange(1, 2, false),
      });

      expect(component.cells()).toBe(before);
    });
  });

  describe('modals', () => {
    it('opens the view modal without an index', () => {
      component.setShowModal();

      expect(component.showModal()).toBe(true);
    });

    it('opens the view modal for a specific row', () => {
      component.tasks = [task()];

      component.setShowModal(0);

      expect(component.showModal()).toBe(true);
    });

    it('opens the edit modal against the selected task', () => {
      const target = task({ id: 'task-9' });

      component.setShowEditModal(target);

      expect(component.selectedTask()).toBe(target);
      expect(component.showEditModal()).toBe(true);
    });

    it('closes the view modal', () => {
      component.setShowModal();

      component.closeModal();

      expect(component.showModal()).toBe(false);
    });
  });

  describe('form submission', () => {
    it('emits the edited task and closes the edit modal', () => {
      const edited = jest.fn();
      component.editTask.subscribe(edited);
      component.setShowEditModal(task());

      const updated = task({ title: 'Updated' });
      component.onEditFormSubmit(updated);

      expect(edited).toHaveBeenCalledWith(updated);
      expect(component.showEditModal()).toBe(false);
    });

    it('narrows a submitted task down to the create payload', () => {
      const created = jest.fn();
      component.createTask.subscribe(created);
      component.setShowModal();

      component.onCreateFormSubmit(
        task({ id: 'ignored', assignee: 'ignored' })
      );

      // Only the six creation fields travel; id and assignee are not the
      // caller's to set.
      expect(created).toHaveBeenCalledWith({
        title: 'Write the spec',
        description: 'Cover the table',
        status: 'open',
        priority: 'high',
        projectId: 'project-1',
        createdBy: 'bob',
      });
      expect(component.showModal()).toBe(false);
    });
  });

  describe('timers', () => {
    it.each([
      ['no time entries at all', undefined, false],
      ['every entry closed', [{ endTime: new Date() }], false],
      ['an entry still open', [{ endTime: null }], true],
      [
        'one open among several closed',
        [{ endTime: new Date() }, { endTime: undefined }],
        true,
      ],
    ])('reports running=%s when there is %s', (_case, entries, expected) => {
      expect(
        component.isTimerRunning(
          task({ timeEntries: entries } as Partial<Task>)
        )
      ).toBe(expected);
    });

    it.each([
      ['Start ⏱️', [{ endTime: new Date() }]],
      ['Stop 🛑', [{ endTime: null }]],
    ])('labels the timer action %s', (label, entries) => {
      const actions = component.getActions(
        task({ timeEntries: entries } as Partial<Task>)
      );

      expect(actions[0].title).toBe(label);
      // The timer action is prepended to the three standing row actions.
      expect(actions.map((a) => a.title).slice(1)).toEqual([
        'View',
        'Edit',
        'Delete',
      ]);
    });

    it('emits the task behind the row when the timer is toggled', () => {
      const toggled = jest.fn();
      component.timerToggled.subscribe(toggled);
      const second = task({ id: 'task-2' });
      component.tasks = [task(), second];

      component.onToggleTimer(1);

      expect(toggled).toHaveBeenCalledWith(second);
    });
  });

  describe('row actions', () => {
    it('routes View to the view modal', () => {
      component.tasks = [task()];

      component.tableActions[0].action(0);

      expect(component.showModal()).toBe(true);
    });

    it('routes Edit to the edit modal for that row', () => {
      const second = task({ id: 'task-2' });
      component.tasks = [task(), second];

      component.tableActions[1].action(1);

      expect(component.selectedTask()).toBe(second);
      expect(component.showEditModal()).toBe(true);
    });

    it('routes Delete to an emit of that row’s id', () => {
      const deleted = jest.fn();
      component.deleteTask.subscribe(deleted);
      component.tasks = [task(), task({ id: 'task-2' })];

      component.tableActions[2].action(1);

      expect(deleted).toHaveBeenCalledWith('task-2');
    });
  });
});
