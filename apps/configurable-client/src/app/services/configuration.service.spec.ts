import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ConfigurationService } from './configuration.service';

describe('ConfigurationService', () => {
  let service: ConfigurationService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ConfigurationService],
    });
    service = TestBed.inject(ConfigurationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('keeps published-domain lookup anonymous', () => {
    service.getConfigurationByDomain('published.example').subscribe();

    const request = http.expectOne(
      '/api/app-config/by-domain/published.example'
    );
    expect(request.request.withCredentials).toBe(false);
    expect(request.request.headers.has('X-ot-appscope')).toBe(false);
    request.flush({});
  });

  it('sends protected owner lookup with cookie credentials and workspace context', () => {
    service.getConfigurationByName('draft-app', 'north-star').subscribe();

    const request = http.expectOne(
      '/api/app-config/by-name/draft-app?workspaceSlug=north-star'
    );
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('X-ot-appscope')).toBe(
      'configurable-client'
    );
    request.flush({});
  });

  it('sends protected ID lookup through the same authenticated context', () => {
    service.getConfiguration('config-1', 'north-star').subscribe();

    const request = http.expectOne(
      '/api/app-config/config-1?workspaceSlug=north-star'
    );
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('X-ot-appscope')).toBe(
      'configurable-client'
    );
    request.flush({});
  });

  it('opens a published app through the non-disclosing public resolver', () => {
    service.getPublishedConfiguration('config-1').subscribe();

    const request = http.expectOne('/api/app-config/apps/config-1');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.has('X-ot-appscope')).toBe(false);
    request.flush({});
  });
});
