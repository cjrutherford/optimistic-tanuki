import {
  clearOwnedBrowserSessionKeys,
  SessionGeneration,
  watchAccountDeletion,
  notifyAccountDeletion,
} from './session-state';

describe('session state helpers', () => {
  it('contains failure to obtain browser storage, not only remove failures', () => {
    expect(() =>
      clearOwnedBrowserSessionKeys(() => {
        throw new Error('blocked');
      }, ['owned'])
    ).not.toThrow();
  });
  it('recognizes only the newest session generation', () => {
    const generation = new SessionGeneration();
    const old = generation.next();
    const current = generation.next();
    expect(generation.isCurrent(old)).toBe(false);
    expect(generation.isCurrent(current)).toBe(true);
  });

  it('removes only explicitly owned storage keys and tolerates failures', () => {
    const removeItem = jest.fn((key: string) => {
      if (key === 'owned-broken') throw new Error('storage unavailable');
    });
    clearOwnedBrowserSessionKeys({ removeItem } as unknown as Storage, [
      'owned-a',
      'owned-broken',
      'owned-c',
    ]);
    expect(removeItem.mock.calls.map(([key]) => key)).toEqual([
      'owned-a',
      'owned-broken',
      'owned-c',
    ]);
  });
});

it('clears only the current account on a deletion event, without clearing a newer account', () => {
  const a = '41000000-0000-4000-8000-000000000001';
  const b = '41000000-0000-4000-8000-000000000002';
  let current = a;
  const clear = jest.fn();
  const stop = watchAccountDeletion(() => current, clear);
  notifyAccountDeletion(a);
  expect(clear).toHaveBeenCalledTimes(1);
  current = b;
  notifyAccountDeletion(a);
  expect(clear).toHaveBeenCalledTimes(1);
  notifyAccountDeletion('invalid');
  expect(clear).toHaveBeenCalledTimes(1);
  notifyAccountDeletion(b);
  expect(clear).toHaveBeenCalledTimes(2);
  stop();
  notifyAccountDeletion(b);
  expect(clear).toHaveBeenCalledTimes(2);
});
