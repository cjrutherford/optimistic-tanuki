import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { WorkspaceDiscoveryApiService } from './workspace-discovery-api.service';
import type { DiscoveredWorkspace } from './workspace-discovery-api.service';
import * as dataAccess from '../index';

type WorkspaceDiscoveryStore = {
  workspaces: () => Array<{ workspaceId: string; displayName: string }>;
  loading: () => boolean;
  error: () => string | null;
  load(): void;
};

type WorkspaceDiscoveryStoreConstructor = new () => WorkspaceDiscoveryStore;

const { WorkspaceDiscoveryStore } = dataAccess as unknown as {
  WorkspaceDiscoveryStore: WorkspaceDiscoveryStoreConstructor;
};

describe('WorkspaceDiscoveryStore', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('loads the authenticated owner workspace list into browser state', () => {
    const api = {
      list: jest.fn().mockReturnValue(
        of([
          {
            workspaceId: 'workspace-1',
            kind: 'business-site',
            slug: 'north-star',
            displayName: 'North Star',
            appScope: 'business-site',
            status: 'active',
          },
        ])
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        WorkspaceDiscoveryStore,
        { provide: WorkspaceDiscoveryApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(WorkspaceDiscoveryStore);

    store.load();

    expect(store.workspaces()).toEqual([
      expect.objectContaining({ workspaceId: 'workspace-1' }),
    ]);
    expect(store.loading()).toBe(false);
  });

  it('keeps an actionable error when discovery cannot load', () => {
    const api = {
      list: jest
        .fn()
        .mockReturnValue(throwError(() => new Error('session expired'))),
    };
    TestBed.configureTestingModule({
      providers: [
        WorkspaceDiscoveryStore,
        { provide: WorkspaceDiscoveryApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(WorkspaceDiscoveryStore);

    store.load();

    expect(store.error()).toBe('session expired');
    expect(store.loading()).toBe(false);
  });

  it('keeps only the latest discovery response when loads race', () => {
    const first = new Subject<DiscoveredWorkspace[]>();
    const second = new Subject<DiscoveredWorkspace[]>();
    const api = {
      list: jest.fn().mockReturnValueOnce(first).mockReturnValueOnce(second),
    };
    TestBed.configureTestingModule({
      providers: [
        WorkspaceDiscoveryStore,
        { provide: WorkspaceDiscoveryApiService, useValue: api },
      ],
    });
    const store = TestBed.inject(WorkspaceDiscoveryStore);

    store.load();
    store.load();
    second.next([
      {
        workspaceId: 'latest',
        kind: 'community',
        slug: 'latest',
        displayName: 'Latest',
        appScope: 'configurable-client',
        status: 'active',
      },
    ]);
    first.next([
      {
        workspaceId: 'stale',
        kind: 'community',
        slug: 'stale',
        displayName: 'Stale',
        appScope: 'configurable-client',
        status: 'active',
      },
    ]);

    expect(store.workspaces()).toEqual([
      expect.objectContaining({ workspaceId: 'latest' }),
    ]);
  });
});
