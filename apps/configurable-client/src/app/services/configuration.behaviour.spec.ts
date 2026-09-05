import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import type { AppConfiguration } from '@optimistic-tanuki/app-config-models';

import { ConfigurationService } from './configuration.service';

function makeConfig(
  overrides: Partial<AppConfiguration> = {}
): AppConfiguration {
  return {
    id: 'cfg-1',
    name: 'demo-app',
    landingPage: { layout: 'single-column', sections: [] },
    routes: [],
    features: {},
    theme: { mode: 'light' },
    active: true,
    ...overrides,
  };
}

describe('ConfigurationService', () => {
  let service: ConfigurationService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ConfigurationService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(ConfigurationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  describe('lookups', () => {
    it('GETs /api/app-config/by-domain/:domain and emits the configuration', () => {
      const config = makeConfig({ domain: 'tenant.example.com' });
      let received: AppConfiguration | undefined;

      service
        .getConfigurationByDomain('tenant.example.com')
        .subscribe((value) => (received = value));

      const request = http.expectOne(
        '/api/app-config/by-domain/tenant.example.com'
      );
      expect(request.request.method).toBe('GET');
      expect(request.request.body).toBeNull();
      request.flush(config);

      expect(received).toEqual(config);
    });

    it('GETs /api/app-config/by-name/:name and emits the configuration', () => {
      const config = makeConfig({ name: 'other-app' });
      let received: AppConfiguration | undefined;

      service
        .getConfigurationByName('other-app')
        .subscribe((value) => (received = value));

      const request = http.expectOne('/api/app-config/by-name/other-app');
      expect(request.request.method).toBe('GET');
      request.flush(config);

      expect(received).toEqual(config);
    });

    it('GETs /api/app-config/:id and emits the configuration', () => {
      const config = makeConfig({ id: 'abc123' });
      let received: AppConfiguration | undefined;

      service
        .getConfiguration('abc123')
        .subscribe((value) => (received = value));

      const request = http.expectOne('/api/app-config/abc123');
      expect(request.request.method).toBe('GET');
      request.flush(config);

      expect(received).toEqual(config);
    });

    it('propagates transport failures to the subscriber', () => {
      let status: number | undefined;

      service.getConfigurationByName('missing-app').subscribe({
        error: (err: { status: number }) => (status = err.status),
      });

      http
        .expectOne('/api/app-config/by-name/missing-app')
        .flush('not found', { status: 404, statusText: 'Not Found' });

      expect(status).toBe(404);
    });
  });

  describe('current configuration', () => {
    it('starts with no configuration', () => {
      expect(service.getCurrentConfiguration()).toBeNull();
    });

    it('returns the most recently stored configuration', () => {
      const first = makeConfig({ id: 'first' });
      const second = makeConfig({ id: 'second' });

      service.setConfiguration(first);
      expect(service.getCurrentConfiguration()).toBe(first);

      service.setConfiguration(second);
      expect(service.getCurrentConfiguration()).toBe(second);
    });

    it('does not store configurations fetched over HTTP by itself', () => {
      service.getConfigurationByName('demo-app').subscribe();
      http.expectOne('/api/app-config/by-name/demo-app').flush(makeConfig());

      expect(service.getCurrentConfiguration()).toBeNull();
    });
  });
});
