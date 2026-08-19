import type { AppConfiguration } from '@optimistic-tanuki/app-config-models';
import { of, type Observable } from 'rxjs';
import * as dataAccess from './app-config-data-access';

type AppConfigApi = {
  get(id: string): Observable<AppConfiguration>;
  getByDomain(domain: string): Observable<AppConfiguration>;
  update(
    id: string,
    patch: { description?: string }
  ): Observable<AppConfiguration>;
  publish(
    id: string,
    notes: { releaseNotes: string }
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

  it('saves only the supplied draft patch through the shared gateway endpoint', () => {
    const configuration = { id: 'cfg-north-star' } as AppConfiguration;
    const http = {
      get: jest.fn(),
      put: jest.fn().mockReturnValue(of(configuration)),
    };
    const api = new AppConfigApiService(http);

    api
      .update('cfg north/star', { description: 'A revised description' })
      .subscribe();

    expect(http.put).toHaveBeenCalledWith(
      '/api/app-config/cfg%20north%2Fstar',
      { description: 'A revised description' }
    );
  });

  it('publishes through the owner-scoped gateway endpoint without browser ownership fields', () => {
    const http = {
      get: jest.fn(),
      post: jest.fn().mockReturnValue(of({ id: 'cfg-north-star' })),
    };
    const api = new AppConfigApiService(http);

    api.publish('cfg north/star', { releaseNotes: 'Ready' }).subscribe();

    expect(http.post).toHaveBeenCalledWith(
      '/api/app-config/cfg%20north%2Fstar/publish',
      { releaseNotes: 'Ready' }
    );
  });
});
