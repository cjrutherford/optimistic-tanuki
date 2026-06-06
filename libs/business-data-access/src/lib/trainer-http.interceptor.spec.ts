import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { businessHttpInterceptor } from './business-http.interceptor';

describe('businessHttpInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      'business-site:user',
      JSON.stringify({
        token: 'business-site-token',
        profileId: 'profile-1',
        userId: 'user-1',
        email: 'business@example.com',
      })
    );

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([businessHttpInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('adds the business auth token and app scope header to business api requests', () => {
    http.put('/api/business/site-config', {}).subscribe();

    const request = httpMock.expectOne('/api/business/site-config');
    expect(request.request.headers.get('Authorization')).toBe(
      'Bearer business-site-token'
    );
    expect(request.request.headers.get('x-ot-appscope')).toBe('business-site');
    request.flush({ ok: true });
  });

  it('prefers the client token for client-facing business api requests when both sessions exist', () => {
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

    http.get('/api/business/client/routines').subscribe();

    const request = httpMock.expectOne('/api/business/client/routines');
    expect(request.request.headers.get('Authorization')).toBe(
      'Bearer client-token'
    );
    expect(request.request.headers.get('x-ot-appscope')).toBe('business-site');
    request.flush([]);
  });

  it('prefers the owner token for finance api requests when both sessions exist', () => {
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

    http.get('/api/finance/invoices').subscribe();

    const request = httpMock.expectOne('/api/finance/invoices');
    expect(request.request.headers.get('Authorization')).toBe(
      'Bearer business-site-token'
    );
    expect(request.request.headers.get('x-ot-appscope')).toBe('business-site');
    request.flush([]);
  });
});
