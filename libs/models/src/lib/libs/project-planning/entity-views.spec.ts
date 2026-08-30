import { applyView, BRIEF_FIELDS } from './entity-views';

/**
 * Narrowing what the assistant is handed.
 *
 * A question like "which tasks are unassigned" meant reading twenty thousand
 * characters of JSON to find six words, which is what made the assistant
 * describe payloads instead of answering them.
 */
describe('applyView', () => {
  const task = {
    id: 't1',
    title: 'Book the crane',
    status: 'TODO',
    priority: 'HIGH',
    assignee: null,
    dueDate: '2026-12-01',
    description: 'a description',
    createdBy: 'someone',
    createdAt: '2026-01-01',
    updatedBy: 'someone',
    updatedAt: '2026-01-02',
    deletedAt: null,
  };

  it('keeps what somebody would say out loud about a task', () => {
    const { rows } = applyView([task], 'task');

    expect(Object.keys(rows[0]).sort()).toEqual(
      [...BRIEF_FIELDS['task']].sort()
    );
  });

  it('drops the bookkeeping nobody asks an assistant about', () => {
    const { rows } = applyView([task], 'task');

    expect(rows[0]).not.toHaveProperty('updatedAt');
    expect(rows[0]).not.toHaveProperty('createdBy');
    expect(rows[0]).not.toHaveProperty('deletedAt');
  });

  it('keeps the id, because the tools need it to act afterwards', () => {
    expect(applyView([task], 'task').rows[0]).toHaveProperty('id', 't1');
  });

  it('says which fields it left out rather than dropping them silently', () => {
    // Silent absence is what made the earlier truncation bug take an afternoon
    // to find: a missing field and an empty one look identical.
    const { omitted } = applyView([task], 'task');

    expect(omitted).toContain('updatedAt');
    expect(omitted).toContain('createdBy');
  });

  it('hands back everything when asked for the full view', () => {
    const { rows, omitted } = applyView([task], 'task', 'full');

    expect(rows[0]).toEqual(task);
    expect(omitted).toBeUndefined();
  });

  it('leaves a thing it has no view for alone rather than guessing', () => {
    const odd = [{ id: 'x', whatever: 1 }];

    expect(applyView(odd, 'something-else').rows).toEqual(odd);
  });

  it('reports nothing omitted when a row had nothing extra', () => {
    const lean = [{ id: 't1', title: 'x', status: 'TODO' }];

    expect(applyView(lean, 'task').omitted).toBeUndefined();
  });
});
