import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { BusinessApiService } from './business-api.service';
import { DEFAULT_BUSINESS_SITE_CONFIG } from './business-site.config';

describe('BusinessApiService cookie-session requests', () => {
  let service: BusinessApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    httpMock?.verify();
    localStorage.clear();
  });

  it('uses the cookie session when updating site config', () => {
    localStorage.setItem(
      'business-site:user',
      JSON.stringify({
        token: 'business-site-token',
        profileId: 'profile-1',
        userId: 'user-1',
        email: 'business@example.com',
      })
    );
    localStorage.setItem('business-site:token', 'business-site-token');

    TestBed.configureTestingModule({
      providers: [
        BusinessApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(BusinessApiService);
    httpMock = TestBed.inject(HttpTestingController);

    service.updateSiteConfig('cfg-1', DEFAULT_BUSINESS_SITE_CONFIG).subscribe();

    const request = httpMock.expectOne('/api/business/site-config');
    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.get('Authorization')).toBeNull();
    request.flush({ ok: true });
  });

  it('uses the cookie session when creating a public lead intake', () => {
    localStorage.setItem(
      'business-site:client-user',
      JSON.stringify({
        token: 'client-token',
        profileId: 'client-profile-1',
        userId: 'client-user-1',
        email: 'client@example.com',
      })
    );
    localStorage.setItem('business-site:client-token', 'client-token');

    TestBed.configureTestingModule({
      providers: [
        BusinessApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(BusinessApiService);
    httpMock = TestBed.inject(HttpTestingController);

    service
      .createLeadIntake({
        name: 'Jordan Prospect',
        email: 'jordan@example.com',
        phone: '',
        goal: 'Build a consistent routine',
        context: 'Needs help with accountability.',
        preferredStart: '',
        preferredEnd: '',
      })
      .subscribe();

    const request = httpMock.expectOne('/api/business/leads');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBeNull();
    request.flush({ id: 'lead-1' });
  });

  it('uses the cookie session when listing client bookings without a userId query', () => {
    localStorage.setItem(
      'business-site:client-user',
      JSON.stringify({
        token: 'client-token',
        profileId: 'client-profile-1',
        userId: 'client-user-1',
        email: 'client@example.com',
      })
    );
    localStorage.setItem('business-site:client-token', 'client-token');

    TestBed.configureTestingModule({
      providers: [
        BusinessApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(BusinessApiService);
    httpMock = TestBed.inject(HttpTestingController);

    service.getClientBookings().subscribe();

    const request = httpMock.expectOne('/api/business/bookings');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);
    expect(request.request.headers.get('Authorization')).toBeNull();
    request.flush([]);
  });

  it('uses the cookie session when loading booking eligibility', () => {
    localStorage.setItem(
      'business-site:client-user',
      JSON.stringify({
        token: 'client-token',
        profileId: 'client-profile-1',
        userId: 'client-user-1',
        email: 'client@example.com',
      })
    );
    localStorage.setItem('business-site:client-token', 'client-token');

    TestBed.configureTestingModule({
      providers: [
        BusinessApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(BusinessApiService);
    httpMock = TestBed.inject(HttpTestingController);

    service.getClientBookingStatus().subscribe();

    const request = httpMock.expectOne('/api/business/client-status');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBeNull();
    request.flush({
      accepted: true,
      hasAccount: true,
      stage: 'accepted_client',
      nextAction: 'Choose a published time to request your next session.',
      primaryAction: 'book_session',
    });
  });

  it('requests owner workflow cards from the business API with the cookie session', () => {
    localStorage.setItem(
      'business-site:user',
      JSON.stringify({
        token: 'business-site-token',
        profileId: 'profile-1',
        userId: 'user-1',
        email: 'business@example.com',
      })
    );
    localStorage.setItem('business-site:token', 'business-site-token');

    TestBed.configureTestingModule({
      providers: [
        BusinessApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(BusinessApiService);
    httpMock = TestBed.inject(HttpTestingController);

    service.getOwnerWorkflow().subscribe();

    const request = httpMock.expectOne('/api/business/owner/workflow');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBeNull();
    request.flush([]);
  });
});
