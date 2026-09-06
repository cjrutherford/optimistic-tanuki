import {
  Change,
  Project,
  ProjectJournal,
  Risk,
  Task,
  TaskNote,
} from '@optimistic-tanuki/ui-models';

import {
  ProjectSummaryComponent,
  ProjectSummaryEntity,
} from './project-summary.component';

/**
 * The figures the panel puts above the narrative.
 *
 * These are what the page falls back on when no model has anything to say, so
 * each one has to be right on its own. The component is plain presentation
 * logic over an already-loaded project, so it is exercised directly rather
 * than through a fixture.
 */
describe('ProjectSummaryComponent figures', () => {
  /**
   * Well before and well after any clock this suite could run on, so the
   * "is it overdue?" comparisons against `new Date()` are stable.
   */
  const PAST = new Date('2020-03-04T09:00:00Z');
  const FUTURE = new Date('2999-03-04T09:00:00Z');

  let ids = 0;

  function aTask(parts: Partial<Task> = {}): Task {
    return {
      id: `t${++ids}`,
      projectId: 'p1',
      title: 'Task',
      description: '',
      status: 'TODO',
      priority: 'LOW',
      assignee: 'ada',
      // Tasks without a due date are ordinary, and the overdue check guards
      // for it, so the default here is the absent case rather than a date.
      dueDate: undefined as unknown as Date,
      createdBy: 'ada',
      createdAt: new Date('2025-01-01T00:00:00Z'),
      ...parts,
    };
  }

  function aRisk(parts: Partial<Risk> = {}): Risk {
    return {
      id: `r${++ids}`,
      projectId: 'p1',
      description: 'Risk',
      impact: 'LOW',
      likelihood: 'POSSIBLE',
      status: 'OPEN',
      createdBy: 'ada',
      createdAt: new Date('2025-01-01T00:00:00Z'),
      ...parts,
    };
  }

  function aChange(parts: Partial<Change> = {}): Change {
    return {
      id: `c${++ids}`,
      projectId: 'p1',
      changeType: 'ADDITION',
      changeStatus: 'PENDING',
      changeDescription: 'Change',
      changeDate: new Date('2025-01-01T00:00:00Z'),
      requestor: 'ada',
      resolution: 'PENDING',
      ...parts,
    };
  }

  function anEntry(parts: Partial<ProjectJournal> = {}): ProjectJournal {
    return {
      id: `j${++ids}`,
      projectId: 'p1',
      profileId: 'ada',
      content: 'Journal',
      createdAt: new Date('2025-01-01T00:00:00Z'),
      ...parts,
    };
  }

  function aNote(parts: Partial<TaskNote> = {}): TaskNote {
    return {
      id: `n${++ids}`,
      taskId: 't1',
      profileId: 'ada',
      content: 'Note',
      createdAt: new Date('2025-01-01T00:00:00Z'),
      ...parts,
    };
  }

  function summaryOf(parts: Partial<Project>): ProjectSummaryComponent {
    const component = new ProjectSummaryComponent();
    component.project = {
      id: 'p1',
      owner: 'ada',
      members: [],
      name: 'Lift-in',
      description: '',
      startDate: new Date('2025-01-01T00:00:00Z'),
      endDate: new Date('2025-12-31T00:00:00Z'),
      status: 'Active',
      createdBy: 'ada',
      createdAt: new Date('2025-01-01T00:00:00Z'),
      tasks: [],
      risks: [],
      changes: [],
      journalEntries: [],
      ...parts,
    };
    return component;
  }

  describe('which tasks still count as work', () => {
    it('drops the ones that are finished or filed away', () => {
      const component = summaryOf({
        tasks: [
          aTask({ title: 'Open', status: 'TODO' }),
          aTask({ title: 'Running', status: 'IN_PROGRESS' }),
          aTask({ title: 'Finished', status: 'DONE' }),
          aTask({ title: 'Filed', status: 'ARCHIVED' }),
        ],
      });

      expect(component.activeTasks.map((task) => task.title)).toEqual([
        'Open',
        'Running',
      ]);
    });

    it('counts a past due date as overdue only while the task is still open', () => {
      const component = summaryOf({
        tasks: [
          aTask({ title: 'Late', dueDate: PAST }),
          aTask({ title: 'Late but done', status: 'DONE', dueDate: PAST }),
          aTask({ title: 'Ahead', dueDate: FUTURE }),
          aTask({ title: 'Undated' }),
        ],
      });

      expect(component.overdueTasks.map((task) => task.title)).toEqual([
        'Late',
      ]);
    });

    it('treats only the top two priorities as high priority', () => {
      const component = summaryOf({
        tasks: [
          aTask({ title: 'Top', priority: 'HIGH' }),
          aTask({ title: 'Nearly', priority: 'MEDIUM_HIGH' }),
          aTask({ title: 'Middling', priority: 'MEDIUM' }),
          aTask({ title: 'Low', priority: 'LOW' }),
          aTask({ title: 'Done and urgent', status: 'DONE', priority: 'HIGH' }),
        ],
      });

      expect(component.highPriorityTasks.map((task) => task.title)).toEqual([
        'Top',
        'Nearly',
      ]);
    });
  });

  describe('which risks and changes still need someone', () => {
    it('keeps every risk that is not closed', () => {
      const component = summaryOf({
        risks: [
          aRisk({ description: 'Open', status: 'OPEN' }),
          aRisk({ description: 'Being handled', status: 'IN_PROGRESS' }),
          aRisk({ description: 'Settled', status: 'CLOSED' }),
        ],
      });

      expect(component.unresolvedRisks.map((risk) => risk.description)).toEqual(
        ['Open', 'Being handled']
      );
    });

    it('keeps every change that is neither complete nor discarded', () => {
      const component = summaryOf({
        changes: [
          aChange({ changeDescription: 'Waiting', changeStatus: 'PENDING' }),
          aChange({ changeDescription: 'Drawing', changeStatus: 'DESIGNING' }),
          aChange({ changeDescription: 'Shipped', changeStatus: 'COMPLETE' }),
          aChange({ changeDescription: 'Dropped', changeStatus: 'DISCARDED' }),
        ],
      });

      expect(
        component.pendingChanges.map((change) => change.changeDescription)
      ).toEqual(['Waiting', 'Drawing']);
    });
  });

  describe('the blocker count', () => {
    it('adds overdue tasks to risks that would hurt', () => {
      const component = summaryOf({
        tasks: [
          aTask({ dueDate: PAST }),
          aTask({ dueDate: PAST }),
          aTask({ dueDate: FUTURE }),
        ],
        risks: [
          aRisk({ impact: 'HIGH' }),
          aRisk({ impact: 'MEDIUM' }),
          // Closed, so it is not a blocker however bad it would have been.
          aRisk({ impact: 'HIGH', status: 'CLOSED' }),
        ],
      });

      expect(component.blockers).toBe(3);
    });

    it('is nothing when the project is clear', () => {
      expect(summaryOf({ tasks: [aTask({ dueDate: FUTURE })] }).blockers).toBe(
        0
      );
    });
  });

  describe('the tallies under the headline', () => {
    it('sums tracked time across tasks, counting untracked ones as zero', () => {
      const component = summaryOf({
        tasks: [
          aTask({ totalTimeSeconds: 3600 }),
          aTask({ totalTimeSeconds: 125 }),
          aTask(),
        ],
      });

      expect(component.trackedSeconds).toBe(3725);
    });

    it('counts journal entries and task notes together', () => {
      const component = summaryOf({
        tasks: [
          aTask({ notes: [aNote(), aNote()] }),
          aTask({ notes: [aNote()] }),
          aTask(),
        ],
        journalEntries: [anEntry(), anEntry()],
      });

      expect(component.noteCount).toBe(5);
    });

    it.each([
      [0, '0m'],
      [59, '0m'],
      [90, '1m'],
      [3600, '1h 0m'],
      [3725, '1h 2m'],
      [86400, '24h 0m'],
    ])('renders %i seconds as %s', (seconds, expected) => {
      expect(summaryOf({}).formatTime(seconds)).toBe(expected);
    });
  });

  describe('the recent activity list', () => {
    it('gathers every kind of thing that happened, newest first', () => {
      const component = summaryOf({
        tasks: [
          aTask({
            title: 'Book the crane',
            createdAt: new Date('2025-05-01T00:00:00Z'),
            notes: [
              aNote({
                content: 'Supplier called back',
                createdAt: new Date('2025-05-05T00:00:00Z'),
              }),
            ],
          }),
        ],
        risks: [
          aRisk({
            description: 'Crane availability',
            createdAt: new Date('2025-05-02T00:00:00Z'),
          }),
        ],
        changes: [
          aChange({
            changeDescription: 'Move the lift a week',
            changeDate: new Date('2025-05-03T00:00:00Z'),
          }),
        ],
        journalEntries: [
          anEntry({
            content: 'Walked the site',
            createdAt: new Date('2025-05-04T00:00:00Z'),
          }),
        ],
      });

      expect(
        component.activity.map((entry) => [
          entry.label,
          entry.type,
          entry.title,
        ])
      ).toEqual([
        ['Task note', 'tasks', 'Book the crane: Supplier called back'],
        ['Journal entry', 'journal', 'Walked the site'],
        ['Change proposed', 'changes', 'Move the lift a week'],
        ['Risk recorded', 'risks', 'Crane availability'],
        ['Task created', 'tasks', 'Book the crane'],
      ]);
    });

    it('shows at most six, keeping the most recent', () => {
      const component = summaryOf({
        journalEntries: Array.from({ length: 9 }, (unused, index) =>
          anEntry({
            content: `Entry ${index}`,
            createdAt: new Date(Date.UTC(2025, 0, index + 1)),
          })
        ),
      });

      expect(component.activity).toHaveLength(6);
      expect(component.activity[0].title).toBe('Entry 8');
      expect(component.activity[5].title).toBe('Entry 3');
    });

    it('leaves out anything whose date will not parse', () => {
      const component = summaryOf({
        journalEntries: [
          anEntry({ content: 'Readable' }),
          anEntry({
            content: 'Unreadable',
            createdAt: 'whenever' as unknown as Date,
          }),
        ],
      });

      expect(component.activity.map((entry) => entry.title)).toEqual([
        'Readable',
      ]);
    });
  });

  describe('the single next thing to do', () => {
    it('sends the reader to the oldest overdue task before anything else', () => {
      const component = summaryOf({
        tasks: [aTask({ title: 'Book the crane', dueDate: PAST })],
        risks: [aRisk()],
        changes: [aChange()],
      });

      expect(component.nextAction).toBe('Resolve Book the crane');
    });

    it('falls to an unresolved risk when nothing is overdue', () => {
      const component = summaryOf({
        tasks: [aTask({ title: 'Ahead', dueDate: FUTURE })],
        risks: [aRisk({ description: 'Crane availability' })],
        changes: [aChange()],
      });

      expect(component.nextAction).toBe('Review risk: Crane availability');
    });

    it('falls to a pending change when the risks are settled', () => {
      const component = summaryOf({
        tasks: [aTask({ title: 'Ahead', dueDate: FUTURE })],
        risks: [aRisk({ status: 'CLOSED' })],
        changes: [aChange({ changeDescription: 'Move the lift a week' })],
      });

      expect(component.nextAction).toBe('Review change: Move the lift a week');
    });

    it('otherwise points at whatever work is open', () => {
      const component = summaryOf({
        tasks: [aTask({ title: 'Confirm access route', dueDate: FUTURE })],
      });

      expect(component.nextAction).toBe('Start Confirm access route');
    });

    it('asks for a first task when the project is empty', () => {
      expect(summaryOf({}).nextAction).toBe(
        'Add the first task to establish momentum'
      );
    });
  });

  /**
   * The panel is also rendered before its project input arrives, so every
   * figure has to survive there rather than throwing on the way in.
   */
  describe('before a project has been set', () => {
    it('reports empty rather than failing', () => {
      const component = new ProjectSummaryComponent();

      expect(component.activeTasks).toEqual([]);
      expect(component.overdueTasks).toEqual([]);
      expect(component.highPriorityTasks).toEqual([]);
      expect(component.unresolvedRisks).toEqual([]);
      expect(component.pendingChanges).toEqual([]);
      expect(component.activity).toEqual([]);
      expect(component.blockers).toBe(0);
      expect(component.trackedSeconds).toBe(0);
      expect(component.noteCount).toBe(0);
      expect(component.evidenceFor('t-uuid')).toBe('t-uuid');
    });
  });

  describe('clicking through to a section', () => {
    it.each<ProjectSummaryEntity>(['tasks', 'risks', 'changes', 'journal'])(
      'announces %s',
      (entity) => {
        const component = summaryOf({});
        const heard: ProjectSummaryEntity[] = [];
        component.entitySelected.subscribe((value) => heard.push(value));

        component.select(entity);

        expect(heard).toEqual([entity]);
      }
    );
  });
});
