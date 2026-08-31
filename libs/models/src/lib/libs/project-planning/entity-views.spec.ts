import { applyView, BRIEF_FIELDS, pageOf } from './entity-views';

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

/**
 * One page of rows, with the total kept separate from the page size.
 *
 * The total is the trap. Counting rows after slicing reports the page size as
 * the answer, so a project of two hundred tasks would say twenty five and mean
 * it. The assistant has already answered a count question wrong twice from a
 * list it could only partly see.
 */
describe('pageOf', () => {
  const many = Array.from({ length: 200 }, (_, i) => ({ id: `t${i}` }));

  it('reports the total, not the number on the page', () => {
    const page = pageOf(many);

    expect(page.count).toBe(200);
    expect(page.showing).toBe(25);
  });

  it('says there is more behind it', () => {
    expect(pageOf(many).more).toBe(true);
  });

  it('says there is not, on the last page', () => {
    const page = pageOf(many, { offset: 175 });

    expect(page.showing).toBe(25);
    expect(page.more).toBe(false);
  });

  it('returns everything when everything fits', () => {
    const few = many.slice(0, 5);

    const page = pageOf(few);

    expect(page).toMatchObject({ count: 5, showing: 5, more: false });
  });

  it('will not be talked into an unbounded page', () => {
    // A limit of a million is how a page quietly becomes no page at all.
    expect(pageOf(many, { limit: 1_000_000 }).showing).toBe(100);
  });

  it('will not be talked into an empty one', () => {
    expect(pageOf(many, { limit: 0 }).showing).toBe(1);
    expect(pageOf(many, { limit: -5 }).showing).toBe(1);
  });

  it('treats a negative offset as the beginning', () => {
    expect(pageOf(many, { offset: -10 }).offset).toBe(0);
  });

  it('comes back empty rather than wrapping when asked past the end', () => {
    const page = pageOf(many, { offset: 500 });

    expect(page).toMatchObject({ count: 200, showing: 0, more: false });
  });

  it('copes with nothing at all', () => {
    expect(pageOf([])).toMatchObject({ count: 0, showing: 0, more: false });
  });
});
