import type {
  AppConfiguration,
  PublishAppConfigDto,
  RollbackAppConfigDto,
  UpdateAppConfigDto,
} from '@optimistic-tanuki/app-config-models';
import { of, type Observable } from 'rxjs';
import * as dataAccess from './app-config-data-access';

type AppConfigApi = {
  get(id: string, workspaceSlug: string): Observable<AppConfiguration>;
  getByDomain(domain: string): Observable<AppConfiguration>;
  update(
    id: string,
    patch: UpdateAppConfigDto,
    workspaceSlug: string
  ): Observable<AppConfiguration>;
  publish(
    id: string,
    notes: PublishAppConfigDto,
    workspaceSlug: string
  ): Observable<AppConfiguration>;
  rollback(
    id: string,
    payload: RollbackAppConfigDto,
    workspaceSlug: string
  ): Observable<AppConfiguration>;
};

type AppConfigApiConstructor = new (http: {
  get: jest.Mock;
  post?: jest.Mock;
}) => AppConfigApi;

const { AppConfigApiService } = dataAccess as unknown as {
  AppConfigApiService: AppConfigApiConstructor;
};

describe('AppConfigApiService', () => {
  it('loads a configuration by an encoded domain through the shared gateway endpoint', () => {
    const configuration = {
      id: 'cfg-north-star',
      name: 'north-star',
      landingPage: { sections: [], layout: 'single' },
      routes: [],
      features: {},
      theme: {},
      active: true,
    } as unknown as AppConfiguration;
    const http = {
      get: jest.fn().mockReturnValue(of(configuration)),
    };
    const api = new AppConfigApiService(http);

    api.getByDomain('north star.example').subscribe();

    expect(http.get).toHaveBeenCalledWith(
      '/api/app-config/by-domain/north%20star.example'
    );
  });

  it('requires workspace scope for mutation call sites at compile time', () => {
    const http = {
      get: jest.fn(),
      put: jest.fn().mockReturnValue(of({})),
      post: jest.fn().mockReturnValue(of({})),
    };
    const api = new AppConfigApiService(http);

    // @ts-expect-error workspaceSlug is required for authenticated update.
    api.update('configuration-1', { expectedRevision: 1 });
    // @ts-expect-error workspaceSlug is required for authenticated rollback.
    api.rollback('configuration-1', {
      expectedRevision: 1,
      version: 1,
      releaseNotes: 'restore',
    });
  });

  it('saves only the supplied draft patch through the shared gateway endpoint', () => {
    const configuration = { id: 'cfg-north-star' } as AppConfiguration;
    const http = {
      get: jest.fn(),
      put: jest.fn().mockReturnValue(of(configuration)),
    };
    const api = new AppConfigApiService(http);

    api
      .update(
        'cfg north/star',
        {
          expectedRevision: 3,
          description: 'A revised description',
        },
        'north star/workspace'
      )
      .subscribe();

    expect(http.put).toHaveBeenCalledWith(
      '/api/app-config/cfg%20north%2Fstar?workspaceSlug=north%20star%2Fworkspace',
      { expectedRevision: 3, description: 'A revised description' },
      {
        withCredentials: true,
        headers: { 'X-ot-appscope': 'configurable-client' },
      }
    );
  });

  it('publishes through the owner-scoped gateway endpoint without browser ownership fields', () => {
    const http = {
      get: jest.fn(),
      post: jest.fn().mockReturnValue(
        of({
          id: 'cfg-north-star',
          workspaceId: 'workspace-1',
          appInstanceId: 'app-1',
          appScope: 'configurable-client',
          revision: 4,
          release: { status: 'draft', history: [] },
        })
      ),
    };
    const api = new AppConfigApiService(http);

    api
      .publish(
        'cfg north/star',
        {
          expectedRevision: 3,
          releaseNotes: 'Ready',
        },
        'north star/workspace'
      )
      .subscribe();

    expect(http.post).toHaveBeenCalledWith(
      '/api/app-config/cfg%20north%2Fstar/publish?workspaceSlug=north%20star%2Fworkspace',
      { expectedRevision: 3, releaseNotes: 'Ready' },
      {
        withCredentials: true,
        headers: { 'X-ot-appscope': 'configurable-client' },
      }
    );
  });

  it('loads an owner configuration with an encoded workspace scope', () => {
    const http = {
      get: jest.fn().mockReturnValue(
        of({
          id: 'cfg-1',
          workspaceId: 'workspace-1',
          appInstanceId: 'app-1',
          appScope: 'configurable-client',
          revision: 1,
          release: { status: 'draft', history: [] },
        })
      ),
    };
    const api = new AppConfigApiService(http);

    api.get('cfg north/star', 'north star/workspace').subscribe();

    expect(http.get).toHaveBeenCalledWith(
      '/api/app-config/cfg%20north%2Fstar?workspaceSlug=north%20star%2Fworkspace',
      {
        withCredentials: true,
        headers: { 'X-ot-appscope': 'configurable-client' },
      }
    );
  });

  it('rolls back through the owner-scoped gateway endpoint with the expected revision', () => {
    const http = {
      get: jest.fn(),
      post: jest.fn().mockReturnValue(of({ id: 'cfg-north-star' })),
    };
    const api = new AppConfigApiService(http);

    api
      .rollback(
        'cfg north/star',
        {
          expectedRevision: 3,
          version: 2,
          releaseNotes: 'Restore ready release',
        },
        'north star/workspace'
      )
      .subscribe();

    expect(http.post).toHaveBeenCalledWith(
      '/api/app-config/cfg%20north%2Fstar/rollback?workspaceSlug=north%20star%2Fworkspace',
      {
        expectedRevision: 3,
        version: 2,
        releaseNotes: 'Restore ready release',
      },
      {
        withCredentials: true,
        headers: { 'X-ot-appscope': 'configurable-client' },
      }
    );
  });
});
