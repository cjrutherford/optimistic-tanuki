import { FindOptionsWhere } from 'typeorm';

import { withIdConstraint } from './find-options';

interface Row {
  id: string;
  moderationStatus?: string;
  appScope?: string;
}

/**
 * The forum services previously built `{ where: { id }, ...options }`, so a
 * caller-supplied `where` replaced the id constraint and the query returned an
 * arbitrary row. These assert the merge keeps both.
 */
describe('withIdConstraint', () => {
  it('constrains by id when the caller passes no options at all', () => {
    expect(withIdConstraint<Row>('thread-1')).toEqual({
      where: { id: 'thread-1' },
    });
  });

  it('keeps the caller conditions and adds the id', () => {
    const result = withIdConstraint<Row>('thread-1', {
      where: { moderationStatus: 'visible' },
    });

    expect(result.where).toEqual({
      moderationStatus: 'visible',
      id: 'thread-1',
    });
  });

  it('wins over a caller-supplied id, so the named row is the one returned', () => {
    const result = withIdConstraint<Row>('thread-1', {
      where: { id: 'thread-other' },
    });

    expect((result.where as FindOptionsWhere<Row>).id).toBe('thread-1');
  });

  it('constrains every branch of an OR clause', () => {
    // An unconstrained branch would still match rows the caller never named.
    const result = withIdConstraint<Row>('thread-1', {
      where: [{ moderationStatus: 'visible' }, { appScope: 'forum' }],
    });

    expect(result.where).toEqual([
      { moderationStatus: 'visible', id: 'thread-1' },
      { appScope: 'forum', id: 'thread-1' },
    ]);
  });

  it('carries the rest of the find options through untouched', () => {
    const result = withIdConstraint<Row>('thread-1', {
      relations: ['author'],
      order: { id: 'DESC' },
    });

    expect(result.relations).toEqual(['author']);
    expect(result.order).toEqual({ id: 'DESC' });
    expect(result.where).toEqual({ id: 'thread-1' });
  });
});
