import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

import { BusinessApiService } from './business-api.service';

describe('BusinessApiService site config requests', () => {
  let service: BusinessApiService;
  let httpMock: HttpTestingController;

  function initTestingModule() {
    TestBed.configureTestingModule({
      providers: [
        BusinessApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(BusinessApiService);
    httpMock = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    localStorage.clear();
    initTestingModule();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('loads the owner-scoped site config without a slug by default', () => {
    service.getSiteConfig().subscribe();

    const request = httpMock.expectOne('/api/business/site-config');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);
    expect(request.request.headers.get('X-ot-appscope')).toBe('business-site');
    request.flush({ configId: 'cfg-1', config: null });
  });

  it('uses the configured API base for server-side tenant requests', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        BusinessApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://gateway:3000/api' },
      ],
    });
    const serverService = TestBed.inject(BusinessApiService);
    const serverHttp = TestBed.inject(HttpTestingController);

    serverService.getSiteConfigForSlug('emberline-studio').subscribe();

    const request = serverHttp.expectOne(
      (candidate) =>
        candidate.url === 'http://gateway:3000/api/business/site-config' &&
        candidate.params.get('slug') === 'emberline-studio'
    );
    expect(request.request.method).toBe('GET');
    request.flush({ configId: 'emberline-config', config: null });
    serverHttp.verify();
  });

  it('provisions the authenticated owner business site without caller-supplied identity', () => {
    service.provisionBusinessSite().subscribe();

    const request = httpMock.expectOne(
      '/api/workspaces/business-sites/provision'
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({ workspace: { workspaceId: 'workspace-1' }, created: true });
  });

  it('adds the tenant slug when loading a hosted business site config', () => {
    service.getSiteConfigForSlug('north-star-advisory').subscribe();

    const request = httpMock.expectOne(
      (candidate) =>
        candidate.url === '/api/business/site-config' &&
        candidate.params.get('slug') === 'north-star-advisory'
    );

    expect(request.request.method).toBe('GET');
    request.flush({ configId: 'cfg-2', config: null });
  });

  it('adds the tenant slug when updating a hosted business site config', () => {
    service
      .updateSiteConfig('cfg-2', {} as any, 'north-star-advisory')
      .subscribe();

    const request = httpMock.expectOne(
      (candidate) =>
        candidate.url === '/api/business/site-config' &&
        candidate.params.get('slug') === 'north-star-advisory'
    );

    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.get('X-ot-appscope')).toBe('business-site');
    request.flush({ id: 'cfg-2' });
  });

  it('lists feature catalogs with the business-site app scope and workspace slug', () => {
    service.listStoreCatalogs('north-star-advisory').subscribe();
    const storeRequest = httpMock.expectOne(
      (candidate) =>
        candidate.url === '/api/store/catalogs/mine' &&
        candidate.params.get('workspaceSlug') === 'north-star-advisory'
    );
    expect(storeRequest.request.headers.get('X-ot-appscope')).toBe(
      'business-site'
    );
    storeRequest.flush([]);

    service.listBlogCatalogs('north-star-advisory').subscribe();
    const blogRequest = httpMock.expectOne(
      (candidate) =>
        candidate.url === '/api/blog/catalogs/mine' &&
        candidate.params.get('workspaceSlug') === 'north-star-advisory'
    );
    expect(blogRequest.request.headers.get('X-ot-appscope')).toBe(
      'business-site'
    );
    blogRequest.flush([]);
  });

  it('adds the tenant slug when loading hosted business offers', () => {
    service.getOffers('steady-hand-contracting').subscribe();

    const request = httpMock.expectOne(
      (candidate) =>
        candidate.url === '/api/business/offers' &&
        candidate.params.get('slug') === 'steady-hand-contracting'
    );

    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('filters public store products by the configured catalog when provided', () => {
    service.getStoreProducts('catalog-north').subscribe();

    const request = httpMock.expectOne(
      (candidate) =>
        candidate.url === '/api/store/products' &&
        candidate.params.get('catalogId') === 'catalog-north'
    );

    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('loads public blog posts only through the referenced catalog endpoint', () => {
    service.getBlogPosts('catalog-north').subscribe();

    const request = httpMock.expectOne(
      '/api/blog/catalogs/catalog-north/posts'
    );
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('submits contact leads with business-site routing metadata and client auth headers', () => {
    TestBed.resetTestingModule();
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
    initTestingModule();

    service
      .submitContactLead(
        {
          name: 'Jordan Prospect',
          email: 'jordan@example.com',
          company: 'North Star Labs',
          subject: 'Interested in advisory support',
          message: 'Looking for operational guidance.',
          sourcePage: '/sites/north-star-advisory',
        },
        'profile-1'
      )
      .subscribe();

    const request = httpMock.expectOne('/api/contact');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBeNull();
    expect(request.request.body).toEqual({
      name: 'Jordan Prospect',
      email: 'jordan@example.com',
      company: 'North Star Labs',
      subject: 'Interested in advisory support',
      message: 'Looking for operational guidance.',
      sourcePage: '/sites/north-star-advisory',
      appScope: 'business-site',
      routingProfileId: 'profile-1',
      sourceLabel: 'Business Site',
    });
    request.flush({ message: 'ok', leadId: 'lead-1' });
  });

  it('creates public bookings without auth headers and preserves the requested time window', () => {
    const startTime = new Date('2026-06-13T14:00:00.000Z');
    const endTime = new Date('2026-06-13T15:00:00.000Z');

    service
      .createBooking({
        resourceId: 'availability-1',
        title: 'Discovery session',
        description: 'Initial advisory consultation',
        startTime,
        endTime,
        isFreeConsultation: true,
        notes: 'Prefers afternoon slots.',
      })
      .subscribe();

    const request = httpMock.expectOne('/api/business/bookings');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(request.request.body).toEqual({
      resourceId: 'availability-1',
      title: 'Discovery session',
      description: 'Initial advisory consultation',
      startTime,
      endTime,
      isFreeConsultation: true,
      notes: 'Prefers afternoon slots.',
    });
    request.flush({ id: 'booking-1' });
  });

  it('sends owner availability updates to the owner-scoped endpoint', () => {
    service
      .updateOwnerAvailability('availability-1', {
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '12:00',
        isActive: true,
      })
      .subscribe();

    const request = httpMock.expectOne(
      '/api/business/owner/availabilities/availability-1'
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '12:00',
      isActive: true,
    });
    request.flush({ id: 'availability-1' });
  });

  it('sends owner workflow requests with optional tenant slug', () => {
    TestBed.resetTestingModule();
    localStorage.setItem(
      'business-site:user',
      JSON.stringify({
        token: 'owner-token',
        profileId: 'profile-1',
        userId: 'user-1',
        email: 'owner@example.com',
      })
    );
    localStorage.setItem('business-site:token', 'owner-token');
    initTestingModule();

    service.getOwnerWorkflow('steady-hand-contracting').subscribe();

    const request = httpMock.expectOne(
      (candidate) =>
        candidate.url === '/api/business/owner/workflow' &&
        candidate.params.get('slug') === 'steady-hand-contracting'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBeNull();
    request.flush([]);
  });

  it('approves owner bookings with the default hourly rate and workspace note', () => {
    service.approveBooking('booking-1').subscribe();

    const request = httpMock.expectOne(
      '/api/business/owner/bookings/booking-1/approve'
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      hourlyRate: 120,
      notes: 'Approved in the workspace.',
    });
    request.flush({ id: 'booking-1' });
  });

  it('rejects an owner prospect through the scoped business endpoint', () => {
    service.rejectProspect('lead-1').subscribe();

    const request = httpMock.expectOne(
      '/api/business/owner/leads/lead-1/reject'
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({});
    request.flush({
      id: 'lead-1',
      status: 'lost',
      lifecycleState: 'revoked',
      moderationDecision: { outcome: 'reject' },
    });
  });

  it('lists assets with the owner auth header and requested filters', () => {
    TestBed.resetTestingModule();
    localStorage.setItem(
      'business-site:user',
      JSON.stringify({
        token: 'owner-token',
        profileId: 'profile-1',
        userId: 'user-1',
        email: 'owner@example.com',
      })
    );
    localStorage.setItem('business-site:token', 'owner-token');
    initTestingModule();

    service.listAssets('profile-1', 'background').subscribe();

    const request = httpMock.expectOne(
      (candidate) =>
        candidate.url === '/api/asset' &&
        candidate.params.get('profileId') === 'profile-1' &&
        candidate.params.get('type') === 'background'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBeNull();
    request.flush([]);
  });
});
