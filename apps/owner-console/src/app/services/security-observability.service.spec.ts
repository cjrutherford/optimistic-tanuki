import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { SecurityObservabilityService } from './security-observability.service';

describe('SecurityObservabilityService', () => {
  let service: SecurityObservabilityService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SecurityObservabilityService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads masked security events for the dashboard', () => {
    service.events({ from: '2026-07-24T00:00:00.000Z', limit: 50 }).subscribe();

    const request = http.expectOne(
      (candidate) =>
        candidate.url === '/api/security/events' &&
        candidate.params.get('from') === '2026-07-24T00:00:00.000Z' &&
        candidate.params.get('limit') === '50'
    );
    expect(request.request.method).toBe('GET');
    request.flush({ events: [] });
  });
});
