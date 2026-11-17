import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import type { ListingReportReviewItem } from '@optimistic-tanuki/social-contracts';
import { DirectoryListingReportPageComponent } from './directory-listing-report-page.component';

const BASE = 'http://localhost:3000/api/directory/towns/town-1';

function report(
  over: Partial<ListingReportReviewItem> = {}
): ListingReportReviewItem {
  return {
    reportId: 'r1',
    listingId: 'l1',
    listingName: 'Cafe',
    reasonCode: 'safety',
    note: 'Unsafe',
    status: 'received',
    priority: true,
    createdAt: '2026-01-01T00:00:00Z',
    decidedById: null,
    decidedAt: null,
    decisionNote: null,
    suppressionId: null,
    ...over,
  };
}

describe('DirectoryListingReportPageComponent', () => {
  let fixture: ComponentFixture<DirectoryListingReportPageComponent>;
  let component: DirectoryListingReportPageComponent;
  let http: HttpTestingController;

  const flushList = (reports: ListingReportReviewItem[]) =>
    http
      .expectOne(
        (r) => r.method === 'GET' && r.url === `${BASE}/listing-reports`
      )
      .flush({ reports });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        DirectoryListingReportPageComponent,
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: API_BASE_URL, useValue: 'http://localhost:3000/api' },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: {
              subscribe: (fn: (p: unknown) => void) =>
                fn(convertToParamMap({ communityId: 'town-1' })),
            },
          },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DirectoryListingReportPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('loads the open queue and renders priority, reason and note', () => {
    const req = http.expectOne(
      (r) => r.method === 'GET' && r.url === `${BASE}/listing-reports`
    );
    expect(req.request.params.get('status')).toBe('open');
    req.flush({ reports: [report()] });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Priority');
    expect(text).toContain('safety');
    expect(text).toContain('Unsafe');
    expect(text).toContain('Received');
    expect(text).not.toMatch(/@/);
  });

  it('shows an empty state', () => {
    flushList([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No reports');
  });

  it('marks a report under review and reloads', () => {
    flushList([report()]);
    component.markUnderReview(report());
    const req = http.expectOne(`${BASE}/listing-reports/r1/review`);
    expect(req.request.body).toEqual({});
    req.flush({ recorded: true });
    flushList([]);
    expect(component.message).toBe('Report marked under review.');
  });

  it('requires a note to decline', () => {
    flushList([report()]);
    component.openDecline(report());
    component.submitDecline(report());
    http.expectNone(`${BASE}/listing-reports/r1/decline`);
    expect(component.message).toContain('note');
    component.setDeclineNote('  not a listing issue ');
    component.submitDecline(report());
    const req = http.expectOne(`${BASE}/listing-reports/r1/decline`);
    expect(req.request.body).toEqual({ note: 'not a listing issue' });
    req.flush({ recorded: true });
    flushList([]);
  });

  it('suppresses with the mapped reason then resolves with the link', () => {
    flushList([report({ reasonCode: 'rights-request' })]);
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: () => '11111111-1111-4111-8111-111111111111' },
    });
    component.openSuppression(report({ reasonCode: 'rights-request' }));
    const sup = http.expectOne(`${BASE}/listing-suppressions`);
    expect(sup.request.body).toEqual({
      suppressionId: '11111111-1111-4111-8111-111111111111',
      listingId: 'l1',
      reasonCode: 'rights-request',
      attested: true,
    });
    sup.flush({ replayed: false });
    const res = http.expectOne(`${BASE}/listing-reports/r1/resolve`);
    expect(res.request.body).toEqual({
      suppressionId: '11111111-1111-4111-8111-111111111111',
    });
    res.flush({ recorded: true });
    flushList([]);
  });

  it('does not resolve when suppression fails and shows a safe message', () => {
    flushList([report()]);
    component.openSuppression(report());
    http
      .expectOne(`${BASE}/listing-suppressions`)
      .flush('stack', { status: 500, statusText: 'x' });
    http.expectNone(`${BASE}/listing-reports/r1/resolve`);
    expect(component.message).toBe(
      'Listing reports are unavailable. Try again.'
    );
  });
});
