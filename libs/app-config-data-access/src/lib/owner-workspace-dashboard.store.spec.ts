import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { AppConfigApiService } from './app-config-data-access';
import { OwnerWorkspaceDashboardStore } from './owner-workspace-dashboard.store';
import { WorkspaceDiscoveryApiService } from './workspace-discovery-api.service';
import type { DiscoveredWorkspace } from './workspace-discovery-api.service';

const owner: DiscoveredWorkspace = {
  workspaceId: 'workspace-1',
  kind: 'community' as const,
  slug: 'north-star',
  displayName: 'North Star',
  appScope: 'configurable-client',
  appInstanceId: 'app-1',
  configurationId: 'config-1',
  status: 'active' as const,
  membershipRole: 'owner' as const,
  membershipStatus: 'active' as const,
};

const configuration = (overrides: Record<string, unknown> = {}) => ({
  id: 'config-1',
  name: 'north-star',
  appScope: 'configurable-client',
  workspaceId: 'workspace-1',
  appInstanceId: 'app-1',
  active: true,
  revision: 4,
  landingPage: { sections: [], layout: 'single' },
  routes: [],
  features: {},
  theme: {},
  release: { status: 'draft', history: [] },
  ...overrides,
});

describe('OwnerWorkspaceDashboardStore', () => {
  afterEach(() => TestBed.resetTestingModule());

  function createStore(
    workspace = owner,
    config = configuration(),
    publish = of(config)
  ) {
    const discovery = {
      list: jest.fn().mockReturnValue(of([workspace])),
    };
    const appConfig = {
      get: jest.fn().mockReturnValue(of(config)),
      publish: jest.fn().mockReturnValue(publish),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: WorkspaceDiscoveryApiService, useValue: discovery },
        { provide: AppConfigApiService, useValue: appConfig },
        OwnerWorkspaceDashboardStore,
      ],
    });
    return {
      store: TestBed.inject(OwnerWorkspaceDashboardStore),
      discovery,
      appConfig,
    };
  }

  it('keeps dashboard reads and owner actions exclusive to the owner role', () => {
    const { store } = createStore({ ...owner, membershipRole: 'admin' });
    store.load('north-star');

    expect(store.state()).toBe('unavailable');
    expect(store.dashboard()).toBeNull();
  });

  it.each(['admin', 'moderator', 'member'] as const)(
    'denies %s dashboard reads and publishing',
    (role) => {
      const { store, appConfig } = createStore({
        ...owner,
        membershipRole: role,
      });
      store.load('north-star');

      expect(store.state()).toBe('unavailable');
      expect(store.dashboard()).toBeNull();
      expect(appConfig.get).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['published', 'published'],
    ['changes-pending', 'pending'],
    ['rollback', 'rolled-back'],
  ] as const)('maps the %s release state to %s', (source, expected) => {
    const release =
      source === 'rollback'
        ? { status: 'draft', history: [{ action: 'rollback' }] }
        : { status: source, history: [] };
    const { store } = createStore(owner, configuration({ release }));
    store.load('north-star');
    expect(store.dashboard()?.configuration.releaseStatus).toBe(expected);
  });

  it('uses the latest release history entry when reporting rollback status', () => {
    const { store } = createStore(
      owner,
      configuration({
        release: {
          status: 'published',
          publishedVersion: 2,
          history: [
            { version: 1, action: 'publish' },
            { version: 2, action: 'rollback' },
          ],
        },
      })
    );

    store.load('north-star');

    expect(store.dashboard()?.configuration.releaseStatus).toBe('rolled-back');
  });

  it('rejects a foreign slug and does not load its configuration', () => {
    const { store, appConfig } = createStore();
    store.load('foreign-workspace');

    expect(store.state()).toBe('unavailable');
    expect(store.dashboard()).toBeNull();
    expect(appConfig.get).not.toHaveBeenCalled();
  });

  it('rejects inactive workspace data instead of displaying it', () => {
    const { store, appConfig } = createStore({ ...owner, status: 'suspended' });
    store.load('north-star');

    expect(store.state()).toBe('unavailable');
    expect(store.dashboard()).toBeNull();
    expect(appConfig.get).not.toHaveBeenCalled();
  });

  it('rejects workspaces with missing identity fields', () => {
    const { store, appConfig } = createStore({
      ...owner,
      workspaceId: ' ',
      appInstanceId: '',
    });
    store.load('north-star');

    expect(store.state()).toBe('unavailable');
    expect(appConfig.get).not.toHaveBeenCalled();
  });

  it('rejects a configuration with missing identity fields', () => {
    const { store } = createStore(
      owner,
      configuration({ appInstanceId: '', appScope: '' })
    );
    store.load('north-star');

    expect(store.state()).toBe('unavailable');
    expect(store.dashboard()).toBeNull();
  });

  it('rejects a workspace without a membership role as incomplete', () => {
    const { store, appConfig } = createStore({
      ...owner,
      membershipRole: undefined,
    });
    store.load('north-star');

    expect(store.state()).toBe('unavailable');
    expect(store.dashboard()).toBeNull();
    expect(appConfig.get).not.toHaveBeenCalled();
  });

  it('keeps the store loading while discovery is pending', () => {
    const discoveryRequest = new Subject<DiscoveredWorkspace[]>();
    const discovery = { list: jest.fn().mockReturnValue(discoveryRequest) };
    const appConfig = { get: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: WorkspaceDiscoveryApiService, useValue: discovery },
        { provide: AppConfigApiService, useValue: appConfig },
        OwnerWorkspaceDashboardStore,
      ],
    });
    const store = TestBed.inject(OwnerWorkspaceDashboardStore);

    store.load('north-star');

    expect(store.state()).toBe('loading');
    expect(store.dashboard()).toBeNull();
  });

  it('exposes an empty state when the owned workspace has no configuration', () => {
    const { store, appConfig } = createStore({
      ...owner,
      configurationId: undefined,
    });
    store.load('north-star');

    expect(store.state()).toBe('empty');
    expect(store.dashboard()).toBeNull();
    expect(appConfig.get).not.toHaveBeenCalled();
  });

  it('ignores stale discovery and configuration responses from an older load', () => {
    const firstDiscovery = new Subject<DiscoveredWorkspace[]>();
    const secondDiscovery = new Subject<DiscoveredWorkspace[]>();
    const firstConfig = new Subject<any>();
    const secondConfig = new Subject<any>();
    const discovery = {
      list: jest
        .fn()
        .mockReturnValueOnce(firstDiscovery)
        .mockReturnValueOnce(secondDiscovery),
    };
    const appConfig = {
      get: jest
        .fn()
        .mockReturnValueOnce(firstConfig)
        .mockReturnValueOnce(secondConfig),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: WorkspaceDiscoveryApiService, useValue: discovery },
        { provide: AppConfigApiService, useValue: appConfig },
        OwnerWorkspaceDashboardStore,
      ],
    });
    const store = TestBed.inject(OwnerWorkspaceDashboardStore);

    store.load('first');
    firstDiscovery.next([{ ...owner, slug: 'first' }]);
    store.load('second');
    secondDiscovery.next([{ ...owner, slug: 'second' }]);
    secondConfig.next(configuration({ name: 'second' }));
    firstConfig.next(configuration({ name: 'first' }));

    expect(store.dashboard()?.workspace.slug).toBe('second');
    expect(store.dashboard()?.app.name).toBe('second');
  });

  it('does not optimistically publish and retains the prior state on failure', () => {
    const publish = new Subject<any>();
    const prior = configuration();
    const { store, appConfig } = createStore(owner, prior, publish);
    store.load('north-star');
    store.publish('Ready').subscribe({ error: () => undefined });

    expect(store.publishing()).toBe(true);
    expect(store.dashboard()?.configuration.releaseStatus).toBe('draft');
    publish.error(new Error('stale revision'));

    expect(store.publishing()).toBe(false);
    expect(store.publishError()).toBe('stale revision');
    expect(store.dashboard()?.configuration.releaseStatus).toBe('draft');
    expect(appConfig.publish).toHaveBeenCalledWith(
      'config-1',
      {
        expectedRevision: 4,
        releaseNotes: 'Ready',
      },
      'north-star'
    );
  });

  it('does not send a publish request for a member workspace', () => {
    const { store, appConfig } = createStore({
      ...owner,
      membershipRole: 'member',
    });
    store.load('north-star');

    store.publish('Not allowed').subscribe({ error: () => undefined });

    expect(appConfig.publish).not.toHaveBeenCalled();
    expect(store.publishing()).toBe(false);
  });

  it('rejects a publish response for a different configuration', () => {
    const { store } = createStore(
      owner,
      configuration(),
      of(
        configuration({
          id: 'foreign-config',
          revision: 5,
          release: { status: 'published', history: [] },
        })
      )
    );
    store.load('north-star');

    let error: unknown;
    store.publish('Ready').subscribe({ error: (reason) => (error = reason) });

    expect(error).toEqual(
      new Error('The server returned an unexpected app context.')
    );
    expect(store.dashboard()?.configuration.id).toBe('config-1');
    expect(store.dashboard()?.configuration.releaseStatus).toBe('draft');
  });

  it('updates release status and revision only from the publish response', () => {
    const published = configuration({
      revision: 5,
      release: {
        status: 'published',
        publishedVersion: 5,
        history: [{ version: 5, action: 'publish', releaseNotes: 'Ready' }],
      },
    });
    const { store } = createStore(owner, configuration(), of(published));
    store.load('north-star');
    store.publish('Ready').subscribe();

    expect(store.dashboard()?.configuration).toEqual(
      expect.objectContaining({
        revision: 5,
        releaseStatus: 'published',
        publishedVersion: 5,
        releaseHistory: [
          expect.objectContaining({ version: 5, releaseNotes: 'Ready' }),
        ],
      })
    );
    expect(store.publishing()).toBe(false);
  });

  it('exposes retry after a load failure', () => {
    const discovery = {
      list: jest
        .fn()
        .mockReturnValueOnce(throwError(() => new Error('offline')))
        .mockReturnValueOnce(of([owner])),
    };
    const appConfig = { get: jest.fn().mockReturnValue(of(configuration())) };
    TestBed.configureTestingModule({
      providers: [
        { provide: WorkspaceDiscoveryApiService, useValue: discovery },
        { provide: AppConfigApiService, useValue: appConfig },
        OwnerWorkspaceDashboardStore,
      ],
    });
    const store = TestBed.inject(OwnerWorkspaceDashboardStore);

    store.load('north-star');
    expect(store.state()).toBe('error');
    store.retry();
    expect(store.state()).toBe('ready');
  });
});
