import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { LeadOnboardingService } from './lead-onboarding.service';

/**
 * The spec beside this one covers resume upload and onboarding confirmation.
 * These pin the remaining endpoints, plus the one call that reshapes its
 * argument: analyzeMadLib accepts either a bare string or a request object and
 * must send the object form either way.
 */
describe('LeadOnboardingService endpoint routing', () => {
  let service: LeadOnboardingService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LeadOnboardingService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts the onboarding profile for analysis', () => {
    const profile = { headline: 'Engineer' };

    service.analyzeOnboarding(profile as never).subscribe();

    const request = http.expectOne('/api/leads/onboarding/analyze');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(profile);
    request.flush({ topics: [] });
  });

  it.each<[string, string | { text: string }, { text: string }]>([
    ['a bare string', 'I build things', { text: 'I build things' }],
    [
      'an already-shaped request',
      { text: 'I build things' },
      { text: 'I build things' },
    ],
  ])('wraps %s into the mad-lib request body', (_case, input, expected) => {
    service.analyzeMadLib(input as never).subscribe();

    const request = http.expectOne('/api/leads/onboarding/mad-lib/analyze');
    expect(request.request.body).toEqual(expected);
    request.flush({});
  });

  it('passes the location query as a search parameter', () => {
    service.searchLocations('Austin').subscribe();

    const request = http.expectOne(
      (r) => r.url === '/api/leads/locations/autocomplete'
    );
    expect(request.request.params.get('q')).toBe('Austin');
    request.flush([]);
  });

  it('advances the DISC interview with the request body', () => {
    const body = { answers: [] };

    service.advanceDiscInterview(body as never).subscribe();

    const request = http.expectOne('/api/leads/onboarding/disc/advance');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush({});
  });

  it('wraps a company name for the ATS lookup', () => {
    service.lookupAtsCompany('Acme').subscribe();

    const request = http.expectOne('/api/leads/ats/company/lookup');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ companyName: 'Acme' });
    request.flush([]);
  });

  it('reads ATS company suggestions', () => {
    service.suggestAtsCompanies().subscribe();

    const request = http.expectOne('/api/leads/ats/company/suggestions');
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });
});
