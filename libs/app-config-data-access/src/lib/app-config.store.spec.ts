import { TestBed } from '@angular/core/testing';
import type {
  AppConfiguration,
  UpdateAppConfigDto,
} from '@optimistic-tanuki/app-config-models';
import { of, Subject, throwError } from 'rxjs';
import { AppConfigApiService } from './app-config-data-access';
import * as dataAccess from '../index';
import type { ScopedAppConfiguration } from './scoped-app-configuration.contract';

type AppConfigStore = {
  selected: () => AppConfiguration | null;
  draft: () => Partial<UpdateAppConfigDto> | null;
  latest: () => AppConfiguration | null;
  latestSnapshot: () => AppConfiguration | null;
  latestLoading: () => boolean;
  latestError: () => string | null;
  loadError: () => string | null;
  saveError: () => string | null;
  saveConflict: () => boolean;
  saving: () => boolean;
  workspaceSlug: () => string | null;
  load(configurationId: string, workspaceSlug: string): void;
  setDraft(patch: Partial<UpdateAppConfigDto>): void;
  refreshLatest(): void;
  acceptLatest(options: { preserveDraft: boolean }): void;
  clearDraft(): void;
  clearSaveRecovery(): void;
  save(): void;
};

type AppConfigStoreConstructor = new () => AppConfigStore;

const { AppConfigStore } = dataAccess as unknown as {
  AppConfigStore: AppConfigStoreConstructor;
};

function scopedConfiguration(
  overrides: Partial<AppConfiguration> &
    Partial<Pick<ScopedAppConfiguration, 'workspaceId' | 'appInstanceId'>> = {}
): AppConfiguration {
  return {
    id: 'cfg-north-star',
    workspaceId: 'workspace-1',
    appInstanceId: 'app-instance-1',
    appScope: 'configurable-client',
    revision: 7,
    release: { status: 'draft', history: [] },
    ...overrides,
  } as AppConfiguration;
}

describe('AppConfigStore', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('ignores a stale domain response after a newer configuration load starts', () => {
    const firstRequest = new Subject<AppConfiguration>();
    const secondRequest = new Subject<AppConfiguration>();
    const api = {
      get: jest
        .fn()
        .mockReturnValueOnce(firstRequest)
        .mockReturnValueOnce(secondRequest),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.load('first-config', 'first-workspace');
    store.load('second-config', 'second-workspace');

    secondRequest.next({ id: 'second-config' } as AppConfiguration);
    firstRequest.next({ id: 'first-config' } as AppConfiguration);

    expect(store.selected()?.id).toBe('second-config');
  });

  it('preserves the last valid configuration and exposes a recoverable load error', () => {
    const api = {
      get: jest
        .fn()
        .mockReturnValue(throwError(() => new Error('network offline'))),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.load('cfg-north-star', 'north-star');

    expect(store.selected()).toBeNull();
    expect(store.loadError()).toBe('network offline');
  });

  it('saves the staged draft and replaces it with the server configuration', () => {
    const loaded = {
      id: 'cfg-north-star',
      description: 'Original description',
      revision: 7,
    } as AppConfiguration;
    const saved = {
      id: 'cfg-north-star',
      description: 'Saved description',
      revision: 8,
    } as AppConfiguration;
    const api = {
      get: jest.fn().mockReturnValue(of(loaded)),
      update: jest.fn().mockReturnValue(of(saved)),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.load('cfg-north-star', 'north-star');
    store.setDraft({ expectedRevision: 1, description: 'Saved description' });
    store.save();

    expect(api.get).toHaveBeenCalledWith('cfg-north-star', 'north-star');
    expect(api.update).toHaveBeenCalledWith(
      'cfg-north-star',
      {
        description: 'Saved description',
        expectedRevision: 7,
      },
      'north-star'
    );
    expect(store.selected()).toBe(saved);
    expect(store.draft()).toBeNull();
    expect(store.workspaceSlug()).toBe('north-star');
  });

  it('keeps a newer draft edit when the pending save succeeds', () => {
    const pendingSave = new Subject<AppConfiguration>();
    const loaded = { id: 'cfg-north-star', revision: 7 } as AppConfiguration;
    const saved = { id: 'cfg-north-star', revision: 8 } as AppConfiguration;
    const api = {
      get: jest.fn().mockReturnValue(of(loaded)),
      update: jest.fn().mockReturnValue(pendingSave),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.load('cfg-north-star', 'north-star');
    store.setDraft({ description: 'First draft' });
    store.save();
    store.setDraft({ description: 'Newer draft edit' });

    pendingSave.next(saved);

    expect(store.selected()).toBe(saved);
    expect(store.draft()).toEqual({ description: 'Newer draft edit' });
    expect(store.saving()).toBe(false);
  });

  it('reconciles a same-scope reload with a pending save response', () => {
    const pendingSave = new Subject<AppConfiguration>();
    const pendingReload = new Subject<AppConfiguration>();
    const loaded = { id: 'cfg-north-star', revision: 7 } as AppConfiguration;
    const saved = { id: 'cfg-north-star', revision: 8 } as AppConfiguration;
    const reloaded = { id: 'cfg-north-star', revision: 7 } as AppConfiguration;
    const api = {
      get: jest
        .fn()
        .mockReturnValueOnce(of(loaded))
        .mockReturnValueOnce(pendingReload),
      update: jest.fn().mockReturnValue(pendingSave),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.load('cfg-north-star', 'north-star');
    store.setDraft({ description: 'First draft' });
    store.save();
    store.load('cfg-north-star', 'north-star');
    store.setDraft({ description: 'Newer draft edit' });
    pendingSave.next(saved);
    pendingReload.next(reloaded);

    expect(store.selected()).toBe(saved);
    expect(store.selected()?.revision).toBe(8);
    expect(store.draft()).toEqual({ description: 'Newer draft edit' });
    expect(store.saving()).toBe(false);
  });

  it('does not start a second save after loading another scope while the first is pending', () => {
    const pendingSave = new Subject<AppConfiguration>();
    const first = { id: 'first-config', revision: 7 } as AppConfiguration;
    const second = { id: 'second-config', revision: 12 } as AppConfiguration;
    const api = {
      get: jest
        .fn()
        .mockReturnValueOnce(of(first))
        .mockReturnValueOnce(of(second)),
      update: jest.fn().mockReturnValue(pendingSave),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.load('first-config', 'first-workspace');
    store.setDraft({ description: 'First draft' });
    store.save();
    store.load('second-config', 'second-workspace');
    store.setDraft({ description: 'Second draft' });
    store.save();

    expect(api.update).toHaveBeenCalledTimes(1);
    expect(store.saving()).toBe(true);

    pendingSave.error({ status: 409 });

    expect(store.selected()).toBe(second);
    expect(store.workspaceSlug()).toBe('second-workspace');
    expect(store.draft()).toEqual({ description: 'Second draft' });
    expect(store.saveError()).toBeNull();
    expect(store.saveConflict()).toBe(false);
    expect(store.saving()).toBe(false);
  });

  it('preserves the last valid selected configuration after a failed same-scope reload', () => {
    const loaded = { id: 'cfg-north-star', revision: 7 } as AppConfiguration;
    const api = {
      get: jest
        .fn()
        .mockReturnValueOnce(of(loaded))
        .mockReturnValueOnce(throwError(() => new Error('network offline'))),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.load('cfg-north-star', 'north-star');
    store.setDraft({ description: 'Keep this draft' });
    store.load('cfg-north-star', 'north-star');

    expect(store.selected()).toBe(loaded);
    expect(store.draft()).toEqual({ description: 'Keep this draft' });
    expect(store.loadError()).toBe('network offline');
  });

  it.each([
    ['a different configuration', 'second-config', 'north-star'],
    ['a different workspace', 'first-config', 'second-workspace'],
  ] as const)(
    'clears the previous draft when loading %s',
    (_label, configurationId, workspaceSlug) => {
      const first = { id: 'first-config', revision: 7 } as AppConfiguration;
      const second = { id: configurationId, revision: 12 } as AppConfiguration;
      const api = {
        get: jest
          .fn()
          .mockReturnValueOnce(of(first))
          .mockReturnValueOnce(of(second)),
      };
      TestBed.configureTestingModule({
        providers: [
          AppConfigStore,
          { provide: AppConfigApiService, useValue: api },
        ],
      });
      const store = TestBed.inject(AppConfigStore);

      store.load('first-config', 'north-star');
      store.setDraft({ description: 'Draft for the first scope' });
      store.load(configurationId, workspaceSlug);

      expect(store.selected()).toBe(second);
      expect(store.workspaceSlug()).toBe(workspaceSlug);
      expect(store.draft()).toBeNull();
    }
  );

  it.each([
    ['a generic failure', new Error('network offline')],
    ['a revision conflict', { status: 409 }],
  ] as const)(
    'preserves the draft when reloading the same scope after %s',
    (_label, error) => {
      const loaded = { id: 'cfg-north-star', revision: 7 } as AppConfiguration;
      const api = {
        get: jest.fn().mockReturnValue(of(loaded)),
        update: jest.fn().mockReturnValue(throwError(() => error)),
      };
      TestBed.configureTestingModule({
        providers: [
          AppConfigStore,
          { provide: AppConfigApiService, useValue: api },
        ],
      });
      const store = TestBed.inject(AppConfigStore);

      store.load('cfg-north-star', 'north-star');
      store.setDraft({ description: 'Keep this draft' });
      store.save();
      store.load('cfg-north-star', 'north-star');

      expect(store.selected()).toBe(loaded);
      expect(store.workspaceSlug()).toBe('north-star');
      expect(store.draft()).toEqual({ description: 'Keep this draft' });
    }
  );

  it('ignores a stale save response after a newer scoped load', () => {
    const firstSave = new Subject<AppConfiguration>();
    const first = { id: 'first-config', revision: 7 } as AppConfiguration;
    const second = { id: 'second-config', revision: 12 } as AppConfiguration;
    const api = {
      get: jest
        .fn()
        .mockReturnValueOnce(of(first))
        .mockReturnValueOnce(of(second)),
      update: jest.fn().mockReturnValue(firstSave),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.load('first-config', 'first-workspace');
    store.setDraft({ description: 'First draft' });
    store.save();
    store.load('second-config', 'second-workspace');
    store.setDraft({ description: 'Second draft' });

    firstSave.next({ id: 'first-config', revision: 8 } as AppConfiguration);

    expect(store.selected()).toBe(second);
    expect(store.workspaceSlug()).toBe('second-workspace');
    expect(store.draft()).toEqual({ description: 'Second draft' });
    expect(store.saving()).toBe(false);
  });

  it('ignores a stale save conflict after a newer scoped load', () => {
    const firstSave = new Subject<AppConfiguration>();
    const first = { id: 'first-config', revision: 7 } as AppConfiguration;
    const second = { id: 'second-config', revision: 12 } as AppConfiguration;
    const api = {
      get: jest
        .fn()
        .mockReturnValueOnce(of(first))
        .mockReturnValueOnce(of(second)),
      update: jest.fn().mockReturnValue(firstSave),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.load('first-config', 'first-workspace');
    store.setDraft({ description: 'First draft' });
    store.save();
    store.load('second-config', 'second-workspace');
    store.setDraft({ description: 'Second draft' });

    firstSave.error({ status: 409 });

    expect(store.selected()).toBe(second);
    expect(store.workspaceSlug()).toBe('second-workspace');
    expect(store.draft()).toEqual({ description: 'Second draft' });
    expect(store.saveError()).toBeNull();
    expect(store.saveConflict()).toBe(false);
    expect(store.saving()).toBe(false);
  });

  it('ignores an overlapping save and retains the draft after a late conflict', () => {
    const pendingSave = new Subject<AppConfiguration>();
    const loaded = { id: 'cfg-north-star', revision: 7 } as AppConfiguration;
    const api = {
      get: jest.fn().mockReturnValue(of(loaded)),
      update: jest.fn().mockReturnValue(pendingSave),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.load('cfg-north-star', 'north-star');
    store.setDraft({ description: 'Keep this draft' });
    store.save();
    store.save();

    expect(api.update).toHaveBeenCalledTimes(1);
    expect(store.draft()).toEqual({ description: 'Keep this draft' });
    expect(store.saving()).toBe(true);

    pendingSave.error({ status: 409 });

    expect(store.selected()).toBe(loaded);
    expect(store.draft()).toEqual({ description: 'Keep this draft' });
    expect(store.saveError()).toBe(
      'Configuration changed elsewhere. Reload the latest revision before retrying.'
    );
    expect(store.saveConflict()).toBe(true);
    expect(store.saving()).toBe(false);
  });

  it.each([
    [
      'a revision conflict',
      { status: 409 },
      'Configuration changed elsewhere. Reload the latest revision before retrying.',
      true,
    ],
    [
      'another save failure',
      new Error('network offline'),
      'network offline',
      false,
    ],
  ] as const)(
    'retains the selected configuration and local draft after %s',
    (_label, error, expectedError, conflict) => {
      const loaded = {
        id: 'cfg-north-star',
        description: 'Original description',
        revision: 7,
      } as AppConfiguration;
      const api = {
        get: jest.fn().mockReturnValue(of(loaded)),
        update: jest.fn().mockReturnValue(throwError(() => error)),
      };
      TestBed.configureTestingModule({
        providers: [
          AppConfigStore,
          { provide: AppConfigApiService, useValue: api },
        ],
      });
      const store = TestBed.inject(AppConfigStore);

      store.load('cfg-north-star', 'north-star');
      store.setDraft({ expectedRevision: 1, description: 'Keep this draft' });
      store.save();

      expect(store.selected()).toBe(loaded);
      expect(store.draft()).toEqual({ description: 'Keep this draft' });
      expect(store.saveError()).toBe(expectedError);
      expect(store.saveConflict()).toBe(conflict);
    }
  );

  it('does not load or save without a nonempty workspace slug', () => {
    const api = {
      get: jest.fn(),
      update: jest.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.load('north-star-config', ' ');

    expect(api.get).not.toHaveBeenCalled();
    expect(store.loadError()).toBe('A workspace slug is required.');
    expect(store.workspaceSlug()).toBeNull();
  });

  it('rejects a scoped response that does not match the selected configuration', () => {
    const api = {
      get: jest.fn().mockReturnValue(
        of({
          id: 'foreign-config',
          workspaceId: 'north-star',
          appInstanceId: 'app-1',
          appScope: 'configurable-client',
          revision: 2,
          release: { status: 'draft', history: [] },
        })
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.load('expected-config', 'north-star');

    expect(store.selected()).toBeNull();
    expect(store.loadError()).toBe(
      'The selected configuration does not match the requested owner context.'
    );
  });

  it.each([
    ['configuration ID', { id: 'foreign-config' }],
    ['workspace identity', { workspaceId: 'foreign-workspace' }],
    [
      'application instance identity',
      { appInstanceId: 'foreign-app-instance' },
    ],
    ['application scope', { appScope: 'business-site' }],
  ] as const)(
    'preserves the loaded selection and draft when an update response mismatches its %s',
    (_label, mismatch) => {
      const loaded = scopedConfiguration();
      const mismatched = scopedConfiguration({
        description: 'Server response from another owner scope',
        revision: 8,
        ...mismatch,
      });
      const api = {
        get: jest.fn().mockReturnValue(of(loaded)),
        update: jest.fn().mockReturnValue(of(mismatched)),
      };
      TestBed.configureTestingModule({
        providers: [
          AppConfigStore,
          { provide: AppConfigApiService, useValue: api },
        ],
      });
      const store = TestBed.inject(AppConfigStore);

      store.load('cfg-north-star', 'north-star');
      store.setDraft({ description: 'Keep this owner draft' });
      store.save();

      expect(store.selected()).toBe(loaded);
      expect(store.draft()).toEqual({ description: 'Keep this owner draft' });
      expect(store.saveError()).toBe(
        'The saved configuration does not match the loaded owner context.'
      );
      expect(store.saveConflict()).toBe(false);
      expect(store.saving()).toBe(false);
    }
  );

  it('refreshes the latest scoped snapshot without changing the selected configuration or draft', () => {
    const latestRequest = new Subject<AppConfiguration>();
    const selected = scopedConfiguration({
      description: 'Selected configuration',
    });
    const latest = scopedConfiguration({
      description: 'Changed elsewhere',
      revision: 8,
    });
    const api = {
      get: jest
        .fn()
        .mockReturnValueOnce(of(selected))
        .mockReturnValueOnce(latestRequest),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.load('cfg-north-star', 'north-star');
    store.setDraft({ description: 'Keep my local draft' });
    store.refreshLatest();

    expect(store.latestLoading()).toBe(true);
    expect(store.selected()).toBe(selected);
    expect(store.draft()).toEqual({ description: 'Keep my local draft' });

    latestRequest.next(latest);

    expect(store.latest()).toBe(latest);
    expect(store.latestSnapshot()).toBe(latest);
    expect(store.latestLoading()).toBe(false);
    expect(store.latestError()).toBeNull();
    expect(store.selected()).toBe(selected);
    expect(store.draft()).toEqual({ description: 'Keep my local draft' });
  });

  it('ignores a same-scope latest response older than the selected revision and keeps the draft safe', () => {
    const selected = scopedConfiguration({
      description: 'Selected configuration',
      revision: 7,
    });
    const staleLatest = scopedConfiguration({
      description: 'Stale server version',
      revision: 6,
    });
    const api = {
      get: jest
        .fn()
        .mockReturnValueOnce(of(selected))
        .mockReturnValueOnce(of(staleLatest)),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.load('cfg-north-star', 'north-star');
    store.setDraft({ description: 'Keep my local draft' });
    store.refreshLatest();
    store.acceptLatest({ preserveDraft: false });

    expect(store.latest()).toBeNull();
    expect(store.selected()).toBe(selected);
    expect(store.draft()).toEqual({ description: 'Keep my local draft' });
    expect(store.latestError()).toBeNull();
  });

  it('does not populate or accept an equal-revision latest response or discard the draft', () => {
    const selected = scopedConfiguration({
      description: 'Selected configuration',
      revision: 7,
    });
    const equalLatest = scopedConfiguration({
      description: 'Equal server version',
      revision: 7,
    });
    const api = {
      get: jest
        .fn()
        .mockReturnValueOnce(of(selected))
        .mockReturnValueOnce(of(equalLatest)),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.load('cfg-north-star', 'north-star');
    store.setDraft({ description: 'Keep my local draft' });
    store.refreshLatest();
    store.acceptLatest({ preserveDraft: false });

    expect(store.latest()).toBeNull();
    expect(store.selected()).toBe(selected);
    expect(store.draft()).toEqual({ description: 'Keep my local draft' });
    expect(store.latestError()).toBeNull();
  });

  it('does not replace the authoritative latest snapshot with an older same-scope response', () => {
    const selected = scopedConfiguration();
    const authoritativeLatest = scopedConfiguration({ revision: 8 });
    const staleLatest = scopedConfiguration({ revision: 7 });
    const api = {
      get: jest
        .fn()
        .mockReturnValueOnce(of(selected))
        .mockReturnValueOnce(of(authoritativeLatest))
        .mockReturnValueOnce(of(staleLatest)),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.load('cfg-north-star', 'north-star');
    store.refreshLatest();
    store.refreshLatest();

    expect(store.latest()).toBe(authoritativeLatest);
    expect(store.latestLoading()).toBe(false);
    expect(store.latestError()).toBeNull();
  });

  it.each([
    ['configuration ID', { id: 'foreign-config' }],
    ['workspace ID', { workspaceId: 'foreign-workspace' }],
    ['app instance ID', { appInstanceId: 'foreign-app-instance' }],
    ['app scope', { appScope: 'business-site' }],
  ] as const)(
    'rejects a latest response with a mismatched %s',
    (_label, mismatch) => {
      const selected = scopedConfiguration();
      const latest = scopedConfiguration({ revision: 8, ...mismatch });
      const api = {
        get: jest
          .fn()
          .mockReturnValueOnce(of(selected))
          .mockReturnValueOnce(of(latest)),
      };
      TestBed.configureTestingModule({
        providers: [
          AppConfigStore,
          { provide: AppConfigApiService, useValue: api },
        ],
      });
      const store = TestBed.inject(AppConfigStore);

      store.load('cfg-north-star', 'north-star');
      store.setDraft({ description: 'Keep my local draft' });
      store.refreshLatest();

      expect(store.latest()).toBeNull();
      expect(store.latestLoading()).toBe(false);
      expect(store.latestError()).toBe(
        'The latest configuration does not match the loaded owner context.'
      );
      expect(store.selected()).toBe(selected);
      expect(store.draft()).toEqual({ description: 'Keep my local draft' });
    }
  );

  it('ignores an older latest response after a newer refresh completes', () => {
    const firstRequest = new Subject<AppConfiguration>();
    const secondRequest = new Subject<AppConfiguration>();
    const selected = scopedConfiguration();
    const firstLatest = scopedConfiguration({ revision: 8 });
    const secondLatest = scopedConfiguration({ revision: 9 });
    const api = {
      get: jest
        .fn()
        .mockReturnValueOnce(of(selected))
        .mockReturnValueOnce(firstRequest)
        .mockReturnValueOnce(secondRequest),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.load('cfg-north-star', 'north-star');
    store.refreshLatest();
    store.refreshLatest();
    secondRequest.next(secondLatest);
    firstRequest.next(firstLatest);

    expect(store.latest()).toBe(secondLatest);
    expect(store.latestLoading()).toBe(false);
    expect(store.latestError()).toBeNull();
  });

  it('ignores a latest response after the active configuration scope changes', () => {
    const latestRequest = new Subject<AppConfiguration>();
    const first = scopedConfiguration();
    const second = scopedConfiguration({
      id: 'cfg-south-star',
      workspaceId: 'workspace-2',
      appInstanceId: 'app-instance-2',
      appScope: 'business-site',
    });
    const api = {
      get: jest
        .fn()
        .mockReturnValueOnce(of(first))
        .mockReturnValueOnce(latestRequest)
        .mockReturnValueOnce(of(second)),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.load('cfg-north-star', 'north-star');
    store.refreshLatest();
    store.load('cfg-south-star', 'south-star');
    latestRequest.next(scopedConfiguration({ revision: 8 }));

    expect(store.latest()).toBeNull();
    expect(store.selected()).toBe(second);
    expect(store.workspaceSlug()).toBe('south-star');
    expect(store.latestError()).toBeNull();
  });

  it('accepts the latest snapshot and discards the draft when requested', () => {
    const selected = scopedConfiguration();
    const latest = scopedConfiguration({
      description: 'Latest server version',
      revision: 8,
    });
    const api = {
      get: jest
        .fn()
        .mockReturnValueOnce(of(selected))
        .mockReturnValueOnce(of(latest)),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.load('cfg-north-star', 'north-star');
    store.setDraft({ description: 'Stale local draft' });
    store.refreshLatest();
    store.acceptLatest({ preserveDraft: false });

    expect(store.selected()).toBe(latest);
    expect(store.draft()).toBeNull();
    expect(store.latest()).toBeNull();
    expect(store.saveError()).toBeNull();
    expect(store.saveConflict()).toBe(false);
  });

  it('accepts the latest snapshot while preserving the draft when requested', () => {
    const selected = scopedConfiguration();
    const latest = scopedConfiguration({
      description: 'Latest server version',
      revision: 8,
    });
    const api = {
      get: jest
        .fn()
        .mockReturnValueOnce(of(selected))
        .mockReturnValueOnce(of(latest)),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.load('cfg-north-star', 'north-star');
    store.setDraft({ description: 'Keep this draft for manual review' });
    store.refreshLatest();
    store.acceptLatest({ preserveDraft: true });

    expect(store.selected()).toBe(latest);
    expect(store.draft()).toEqual({
      description: 'Keep this draft for manual review',
    });
    expect(store.latest()).toBeNull();
  });

  it.each([
    ['missing workspace ID', 'workspaceId', undefined],
    ['empty workspace ID', 'workspaceId', ''],
    ['missing app instance ID', 'appInstanceId', undefined],
    ['empty app instance ID', 'appInstanceId', ''],
    ['missing app scope', 'appScope', undefined],
    ['empty app scope', 'appScope', ''],
  ] as const)(
    'rejects a latest response with %s at the store boundary',
    (_label, field, value) => {
      const selected = scopedConfiguration();
      const latest = scopedConfiguration({ revision: 8 });
      const latestResponse = latest as unknown as Record<string, unknown>;
      if (value === undefined) delete latestResponse[field];
      else latestResponse[field] = value;
      const api = {
        get: jest
          .fn()
          .mockReturnValueOnce(of(selected))
          .mockReturnValueOnce(of(latest)),
      };
      TestBed.configureTestingModule({
        providers: [
          AppConfigStore,
          { provide: AppConfigApiService, useValue: api },
        ],
      });
      const store = TestBed.inject(AppConfigStore);

      store.load('cfg-north-star', 'north-star');
      store.setDraft({ description: 'Keep my local draft' });
      store.refreshLatest();

      expect(store.latest()).toBeNull();
      expect(store.latestLoading()).toBe(false);
      expect(store.latestError()).toBe(
        'The latest configuration does not match the loaded owner context.'
      );
      expect(store.selected()).toBe(selected);
      expect(store.draft()).toEqual({ description: 'Keep my local draft' });
    }
  );

  it('clears only the draft and leaves save recovery state intact', () => {
    const selected = scopedConfiguration();
    const latest = scopedConfiguration({ revision: 8 });
    const api = {
      get: jest
        .fn()
        .mockReturnValueOnce(of(selected))
        .mockReturnValueOnce(of(latest)),
      update: jest.fn().mockReturnValue(throwError(() => ({ status: 409 }))),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.load('cfg-north-star', 'north-star');
    store.setDraft({ description: 'Stale local draft' });
    store.save();
    store.refreshLatest();
    store.clearDraft();

    expect(api.update).toHaveBeenCalledTimes(1);
    expect(store.draft()).toBeNull();
    expect(store.latest()).toBe(latest);
    expect(store.saveError()).toBe(
      'Configuration changed elsewhere. Reload the latest revision before retrying.'
    );
    expect(store.saveConflict()).toBe(true);
  });

  it('clears save recovery without clearing the draft and invalidates an in-flight latest refresh', () => {
    const latestRequest = new Subject<AppConfiguration>();
    const selected = scopedConfiguration();
    const latest = scopedConfiguration({ revision: 8 });
    const api = {
      get: jest
        .fn()
        .mockReturnValueOnce(of(selected))
        .mockReturnValueOnce(latestRequest),
      update: jest.fn().mockReturnValue(throwError(() => ({ status: 409 }))),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.load('cfg-north-star', 'north-star');
    store.setDraft({ description: 'Keep this draft' });
    store.save();
    store.refreshLatest();
    expect(store.latestLoading()).toBe(true);

    store.clearSaveRecovery();
    latestRequest.next(latest);

    expect(store.draft()).toEqual({ description: 'Keep this draft' });
    expect(store.latest()).toBeNull();
    expect(store.latestLoading()).toBe(false);
    expect(store.latestError()).toBeNull();
    expect(store.saveError()).toBeNull();
    expect(store.saveConflict()).toBe(false);
  });

  it('keeps an existing latest snapshot, selected configuration, and draft when a refresh fails', () => {
    const selected = scopedConfiguration({
      description: 'Selected configuration',
    });
    const latest = scopedConfiguration({
      description: 'Existing latest snapshot',
      revision: 8,
    });
    const api = {
      get: jest
        .fn()
        .mockReturnValueOnce(of(selected))
        .mockReturnValueOnce(of(latest))
        .mockReturnValueOnce(throwError(() => new Error('network offline'))),
    };
    TestBed.configureTestingModule({
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(AppConfigStore);

    store.load('cfg-north-star', 'north-star');
    store.setDraft({ description: 'Keep my local draft' });
    store.refreshLatest();
    store.refreshLatest();

    expect(store.latest()).toBe(latest);
    expect(store.latestLoading()).toBe(false);
    expect(store.latestError()).toBe('network offline');
    expect(store.selected()).toBe(selected);
    expect(store.draft()).toEqual({ description: 'Keep my local draft' });
  });
});
