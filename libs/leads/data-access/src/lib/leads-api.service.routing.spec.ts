import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { LeadsApiService } from './leads-api.service';

/**
 * The spec beside this one covers the list and patch calls in detail. These
 * pin the remaining endpoints — whose only real behaviour is the verb and URL
 * they resolve to — as one table, so a mistyped path fails here rather than
 * 404ing at runtime.
 */
describe('LeadsApiService endpoint routing', () => {
  let service: LeadsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LeadsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it.each<[string, () => void, string, string]>([
    [
      'a single lead',
      () => service.getLead('lead-1').subscribe(),
      'GET',
      '/api/leads/lead-1',
    ],
    [
      'the stats overview',
      () => service.getStats().subscribe(),
      'GET',
      '/api/leads/stats/overview',
    ],
    [
      'a lead deletion',
      () => service.deleteLead('lead-1').subscribe(),
      'DELETE',
      '/api/leads/lead-1',
    ],
  ])('routes %s', (_case, call, method, url) => {
    call();

    const request = http.expectOne(url);
    expect(request.request.method).toBe(method);
    request.flush({});
  });

  it('posts the create payload unchanged', () => {
    const dto = { name: 'Ada', email: 'ada@example.com' };

    service.createLead(dto as never).subscribe();

    const request = http.expectOne('/api/leads');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(dto);
    request.flush({});
  });
});
