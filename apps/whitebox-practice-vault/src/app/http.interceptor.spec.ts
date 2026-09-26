import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { HttpClient } from '@angular/common/http';
import { vaultStaffSessionInterceptor } from './http.interceptor';

describe('vaultStaffSessionInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([vaultStaffSessionInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('attaches the staff session contract to WISP and copilot calls', () => {
    http.get('/api/v1/vault/compliance/wisp').subscribe();
    const wisp = httpMock.expectOne('/api/v1/vault/compliance/wisp');
    expect(wisp.request.withCredentials).toBe(true);
    expect(wisp.request.headers.get('X-ot-appscope')).toBe('finance');
    expect(wisp.request.headers.get('X-ot-session-mode')).toBe('cookie');
    wisp.flush({});

    http.post('/api/v1/vault/copilot/query', { query: 'test' }).subscribe();
    const copilot = httpMock.expectOne('/api/v1/vault/copilot/query');
    expect(copilot.request.withCredentials).toBe(true);
    expect(copilot.request.headers.get('X-ot-appscope')).toBe('finance');
    expect(copilot.request.headers.get('X-ot-session-mode')).toBe('cookie');
    copilot.flush({});
  });

  it('leaves public token flows untouched', () => {
    http.post('/api/v1/vault/drop/public-token', {}).subscribe();
    const drop = httpMock.expectOne('/api/v1/vault/drop/public-token');
    expect(drop.request.headers.get('X-ot-appscope')).toBeNull();
    expect(drop.request.headers.get('X-ot-session-mode')).toBeNull();
    drop.flush({});

    http.post('/api/v1/vault/escrow-verify/public-token', {}).subscribe();
    const escrow = httpMock.expectOne(
      '/api/v1/vault/escrow-verify/public-token'
    );
    expect(escrow.request.headers.get('X-ot-appscope')).toBeNull();
    expect(escrow.request.headers.get('X-ot-session-mode')).toBeNull();
    escrow.flush({});
  });
});
