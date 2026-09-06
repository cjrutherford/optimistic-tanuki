import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { BusinessApiService } from './business-api.service';

/**
 * The specs beside this one cover the site-config, booking and lead-intake
 * requests in detail. These pin the remaining thin endpoints — the ones whose
 * only real behaviour is the URL and verb they resolve to — as one table, so a
 * mistyped path shows up as a failure rather than a silent 404 at runtime.
 */
describe('BusinessApiService endpoint routing', () => {
  let service: BusinessApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        BusinessApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(BusinessApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  const reads: [string, () => void, string, string][] = [
    [
      'store products',
      () => service.getStoreProducts().subscribe(),
      'GET',
      '/api/store/products',
    ],
    [
      "an owner's store products",
      () => service.getOwnerProducts('owner-1').subscribe(),
      'GET',
      '/api/store/products/owner/owner-1',
    ],
    [
      'published sites',
      () => service.listPublishedSites().subscribe(),
      'GET',
      '/api/business/sites',
    ],
    [
      'owner bookings',
      () => service.getOwnerBookings().subscribe(),
      'GET',
      '/api/business/owner/bookings',
    ],
    [
      'owner prospects',
      () => service.getOwnerProspects().subscribe(),
      'GET',
      '/api/business/owner/leads',
    ],
    [
      'accepted clients',
      () => service.getAcceptedClients().subscribe(),
      'GET',
      '/api/business/owner/accepted-clients',
    ],
    [
      'owner availabilities',
      () => service.getOwnerAvailabilities().subscribe(),
      'GET',
      '/api/business/owner/availabilities',
    ],
    [
      'owner availability overrides',
      () => service.getOwnerAvailabilityOverrides().subscribe(),
      'GET',
      '/api/business/owner/availability-overrides',
    ],
    [
      'removing an owner availability',
      () => service.removeOwnerAvailability('slot-9').subscribe(),
      'DELETE',
      '/api/business/owner/availabilities/slot-9',
    ],
  ];

  it.each(reads)('routes %s', (_case, call, method, url) => {
    call();

    const request = httpMock.expectOne(url);
    expect(request.request.method).toBe(method);
    request.flush([]);
  });

  const prospectTransitions: [string, () => void, string][] = [
    [
      'marks a prospect contacted',
      () => service.markProspectContacted('lead-3').subscribe(),
      '/api/business/owner/leads/lead-3/contacted',
    ],
    [
      'approves a prospect',
      () => service.approveProspect('lead-3').subscribe(),
      '/api/business/owner/leads/lead-3/approve',
    ],
  ];

  it.each(prospectTransitions)('%s with an empty body', (_case, call, url) => {
    call();

    const request = httpMock.expectOne(url);
    expect(request.request.method).toBe('PUT');
    // These are state transitions, not edits — the body carries nothing.
    expect(request.request.body).toEqual({});
    request.flush({});
  });

  describe('slug-scoped reads', () => {
    // The closures subscribe themselves: returning the observables would give
    // the table a union element type whose `subscribe` overloads no longer
    // resolve to a single callable signature.
    const scoped: [string, (slug?: string) => void, string][] = [
      [
        'offers',
        (slug?: string) => service.getOffers(slug).subscribe(),
        '/api/business/offers',
      ],
      [
        'busy windows',
        (slug?: string) => service.getBusyWindows(slug).subscribe(),
        '/api/business/busy-windows',
      ],
    ];

    it.each(scoped)('adds the tenant slug when reading %s', (_c, call, url) => {
      call('acme');

      const request = httpMock.expectOne((r) => r.url === url);
      expect(request.request.params.get('slug')).toBe('acme');
      request.flush([]);
    });

    it.each(scoped)(
      'omits the slug entirely when reading %s unscoped',
      (_c, call, url) => {
        call();

        const request = httpMock.expectOne((r) => r.url === url);
        expect(request.request.params.has('slug')).toBe(false);
        request.flush([]);
      }
    );
  });
});
