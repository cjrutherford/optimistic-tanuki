import { HttpResponse, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { DirectoryAdminService } from './directory-admin.service';

const api = 'http://localhost:3000/api';
const town = `${api}/directory/towns/t1`;

describe('DirectoryAdminService', () => {
  let service: DirectoryAdminService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: `${api}/` },
      ],
    });
    service = TestBed.inject(DirectoryAdminService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function expectCall(method: string, url: string, body?: unknown) {
    const req = http.expectOne(url);
    expect(req.request.method).toBe(method);
    if (body !== undefined) expect(req.request.body).toEqual(body);
    req.flush({});
    return req;
  }

  it('strips a trailing slash from the API base', () => {
    service.listWithdrawals(50).subscribe();
    expectCall('GET', `${api}/directory/withdrawals?limit=50`);
  });

  it('keeps the platform-wide URLs, methods and bodies', () => {
    const body = { a: 1 };
    service.getOperationsMetrics().subscribe();
    expectCall('GET', `${api}/directory/operations/metrics`);
    service.setOperatingControl('imports', body).subscribe();
    expectCall('POST', `${api}/directory/operations/controls/imports`, body);
    service.listRightsCases('status=open&limit=25&offset=0').subscribe();
    expectCall(
      'GET',
      `${api}/directory/rights-cases?status=open&limit=25&offset=0`
    );
    service.undoRightsCaseDecision('c1', body).subscribe();
    expectCall('POST', `${api}/directory/rights-cases/c1/undo`, body);
    service.startTaxonomyRun(body).subscribe();
    expectCall('POST', `${api}/directory/taxonomy/runs`, body);
    service.rollbackTaxonomyRun('r1', body).subscribe();
    expectCall('POST', `${api}/directory/taxonomy/runs/r1/rollback`, body);
    service.actOnRun('r1', 'pause', body).subscribe();
    expectCall('POST', `${api}/directory/runs/r1/pause`, body);
    service.runTown('t9', body).subscribe();
    expectCall('POST', `${api}/directory/runs/towns/t9/run`, body);
    service.retryExport('j1').subscribe();
    expectCall('POST', `${api}/directory/exports/j1/retry`, {});
  });

  it('keeps the town-scoped URLs, methods and bodies', () => {
    const body = { a: 1 };
    service.listListingReports('t1', 'open').subscribe();
    const reports = http.expectOne((r) => r.url === `${town}/listing-reports`);
    expect(reports.request.params.get('status')).toBe('open');
    reports.flush({});

    service.searchListings('t1', 'cafe').subscribe();
    const search = http.expectOne(
      (r) => r.url === `${town}/local-evaluation-listings`
    );
    expect(search.request.params.get('q')).toBe('cafe');
    expect(search.request.params.get('identities')).toBe('1');
    search.flush({});

    service.actOnListingReport('t1', 'r1', 'decline', body).subscribe();
    expectCall('POST', `${town}/listing-reports/r1/decline`, body);
    service.liftListingSuppression('t1', 's1', body).subscribe();
    expectCall('POST', `${town}/listing-suppressions/s1/lift`, body);
    service.getDuplicateCase('t1', 'c1').subscribe();
    expectCall('GET', `${town}/duplicate-cases/c1`);
    service.judgeDuplicateSample('t1', 's1', body).subscribe();
    expectCall('POST', `${town}/duplicate-cases/samples/s1/judge`, body);
    service.recordIdentityDecision('t1', body).subscribe();
    expectCall('POST', `${town}/business-identity-review/decisions`, body);
    service.decideAddressCandidate('t1', 'a1', body).subscribe();
    expectCall('POST', `${town}/address-review-candidates/a1/decisions`, body);
    service.getBoundaryCandidate('t1').subscribe();
    expectCall('GET', `${town}/boundary-candidate`);
    service.recordBoundaryDecision('t1', body).subscribe();
    expectCall('POST', `${town}/boundary-decisions`, body);
  });

  it('builds the link-review URLs', () => {
    service.listLinkRequests('t1').subscribe();
    expectCall('GET', `${town}/business-link-requests`);
    service.listLinkRequests('t1', 'a b').subscribe();
    expectCall('GET', `${town}/business-link-requests?cursor=a%20b`);
    service.getLinkListing('t1', 'l1', true).subscribe();
    expectCall('GET', `${town}/local-evaluation-listings/l1?adult=1`);
    service.getLinkListing('t1', 'l1', false).subscribe();
    expectCall('GET', `${town}/local-evaluation-listings/l1`);
    service.getCommunity('c1').subscribe();
    expectCall('GET', `${api}/social/community/c1`);
  });

  it('downloads an export as a blob with the full response', () => {
    let response: HttpResponse<Blob> | undefined;
    service.downloadExport('j1').subscribe((r) => (response = r));
    const req = http.expectOne(`${api}/directory/exports/j1/artifact`);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x']), { headers: { 'x-content-sha256': 'abc' } });
    expect(response?.headers.get('x-content-sha256')).toBe('abc');
  });
});
