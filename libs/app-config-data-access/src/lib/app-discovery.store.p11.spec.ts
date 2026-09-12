import { of, Subject, throwError } from 'rxjs';
import { AppDiscoveryStore } from './app-discovery.store';

describe('AppDiscoveryStore P11', () => {
  it('reflects an immediate join result in the card state', () => {
    const api = {
      list: jest.fn().mockReturnValue(
        of([
          {
            appId: 'app-1',
            name: 'North Star',
            accessPolicy: 'joinable',
            membershipStatus: null,
            canOpen: false,
            canJoin: true,
            canRequest: false,
          },
        ])
      ),
      join: jest
        .fn()
        .mockReturnValue(
          of({ appId: 'app-1', status: 'active', role: 'member' })
        ),
      request: jest.fn(),
    };
    const store = new AppDiscoveryStore(api as any);

    store.load();
    store.join('app-1');

    expect(store.apps()[0]).toEqual(
      expect.objectContaining({
        membershipStatus: 'active',
        canOpen: true,
        canJoin: false,
      })
    );
  });

  it('keeps a retryable error when discovery fails', () => {
    const api = {
      list: jest.fn().mockReturnValue(throwError(() => new Error('offline'))),
    };
    const store = new AppDiscoveryStore(api as any);

    store.load();

    expect(store.error()).toContain('offline');
    expect(store.loading()).toBe(false);
  });

  it('keeps the newest search result when an older request finishes later', () => {
    const first = new Subject<any[]>();
    const second = new Subject<any[]>();
    const api = {
      list: jest.fn().mockReturnValueOnce(first).mockReturnValueOnce(second),
    };
    const store = new AppDiscoveryStore(api as any);

    store.load('first');
    store.load('second');
    second.next([{ appId: 'second', name: 'Second', accessPolicy: 'public' }]);
    first.next([{ appId: 'first', name: 'First', accessPolicy: 'public' }]);

    expect(store.apps().map((app) => app.appId)).toEqual(['second']);
    expect(store.loading()).toBe(false);
  });

  it('keeps a membership action error on the affected card instead of hiding the directory', () => {
    const api = {
      list: jest.fn().mockReturnValue(
        of([
          {
            appId: 'app-1',
            name: 'North Star',
            accessPolicy: 'joinable',
            membershipStatus: null,
            canOpen: false,
            canJoin: true,
            canRequest: false,
          },
        ])
      ),
      join: jest.fn().mockReturnValue(
        throwError(() => ({
          error: { message: 'Membership service unavailable' },
        }))
      ),
    };
    const store = new AppDiscoveryStore(api as any);

    store.load();
    store.join('app-1');

    expect(store.error()).toBeNull();
    expect(store.actionError('app-1')).toBe('Membership service unavailable');
    expect(store.apps()[0].appId).toBe('app-1');
    expect(store.actionInFlight('app-1')).toBe(false);
  });
});
