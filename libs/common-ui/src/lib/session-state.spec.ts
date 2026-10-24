import {
  clearOwnedBrowserSessionKeys,
  SessionGeneration,
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
