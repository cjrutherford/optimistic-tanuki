import {
  AiChange,
  AiChangeReviewComponent,
} from './ai-change-review.component';

/**
 * What a reviewer has to be able to tell apart before they press a button.
 *
 * The gate is only worth having if the person operating it can see what they
 * are agreeing to and what became of it afterwards. A row that reads
 * "task.create / APPROVED" satisfies neither.
 */
describe('AiChangeReviewComponent', () => {
  function change(overrides: Partial<AiChange> = {}): AiChange {
    return {
      id: 'c1',
      operation: 'task.create',
      payload: { title: 'Book the crane' },
      status: 'PENDING',
      ...overrides,
    };
  }

  function componentWith(changes: AiChange[]) {
    const component = new AiChangeReviewComponent();
    component.changes = changes;
    return component;
  }

  it('separates what still needs a decision from what has one', () => {
    const component = componentWith([
      change({ id: 'a' }),
      change({ id: 'b', status: 'APPROVED' }),
      change({ id: 'c', status: 'REJECTED' }),
    ]);

    expect(component.pending.map((c) => c.id)).toEqual(['a']);
    expect(component.settled.map((c) => c.id)).toEqual(['b', 'c']);
  });

  describe('showing what the change would do', () => {
    it('names the operation in words rather than its wire name', () => {
      expect(componentWith([]).describe('risk.create')).toBe('Record a risk');
    });

    it('falls back to the raw operation rather than showing nothing', () => {
      expect(componentWith([]).describe('thing.we.added.later')).toBe(
        'thing.we.added.later'
      );
    });

    it('lists the payload so the values are visible, not just the shape', () => {
      const component = componentWith([]);

      const fields = component.fields(
        change({ payload: { title: 'Book the crane', dueDate: '2026-09-01' } })
      );

      expect(fields).toEqual([
        { key: 'Title', value: 'Book the crane' },
        { key: 'Due Date', value: '2026-09-01' },
      ]);
    });

    it('leaves out plumbing and empty values, which tell a reviewer nothing', () => {
      const component = componentWith([]);

      const keys = component
        .fields(
          change({
            payload: {
              title: 'x',
              projectId: 'p1',
              requestingUserId: 'u1',
              description: '',
              assigneeId: null,
            },
          })
        )
        .map((field) => field.key);

      expect(keys).toEqual(['Title']);
    });
  });

  describe('what became of a decided change', () => {
    // Approved and carried out is not the same as approved and failed. A
    // reviewer shown only "Approved" will reasonably believe the board
    // changed.
    it('says so when the work was done', () => {
      expect(
        componentWith([]).outcome(change({ status: 'APPROVED', applied: true }))
      ).toBe('Approved and done');
    });

    it('does not claim the work was done when it failed', () => {
      const outcome = componentWith([]).outcome(
        change({ status: 'APPROVED', applied: false, applyError: 'db down' })
      );

      expect(outcome).not.toContain('done');
      expect(outcome).toContain('did not go through');
    });

    it('reports a rejection as a rejection', () => {
      expect(componentWith([]).outcome(change({ status: 'REJECTED' }))).toBe(
        'Rejected'
      );
    });
  });

  describe('the decision it emits', () => {
    it('carries the note the reviewer typed', () => {
      const component = componentWith([change()]);
      const decisions: unknown[] = [];
      component.decided.subscribe((decision) => decisions.push(decision));
      component.notes['c1'] = '  crane is already booked  ';

      component.reject(change());

      expect(decisions).toEqual([
        {
          id: 'c1',
          status: 'REJECTED',
          reviewNote: 'crane is already booked',
        },
      ]);
    });

    it('sends no note rather than an empty one', () => {
      const component = componentWith([change()]);
      const decisions: { reviewNote?: string }[] = [];
      component.decided.subscribe((decision) => decisions.push(decision));
      component.notes['c1'] = '   ';

      component.approve(change());

      expect(decisions[0].reviewNote).toBeUndefined();
      expect(decisions[0]).toMatchObject({ status: 'APPROVED' });
    });
  });
});
