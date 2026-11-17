import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { DirectoryAddressReviewPageComponent } from './directory-address-review-page.component';

const town = '615482e8-d72b-4500-989f-5b79ceb32781';
const candidate = {
  id: 'b52cfef1-9180-46ba-96d8-cca7149f9bdf',
  communityId: town,
  scanId: 'a'.repeat(64),
  sourceFileRowNumber: '42',
  name: 'Fixture Bakery',
  category: 'bakery',
  addresses: ['10 Main St'],
  rights: 'review',
  risk: { residential: null, sensitive: null, adult: null },
  verdict: 'needs_human',
  reasons: ['rights_review_required'],
  checks: { rights: 'unknown' },
  policyVersion: 'address-review-v1',
  status: 'needs_human',
  createdAt: '2026-11-10T00:00:00.000Z',
  updatedAt: '2026-11-10T00:00:00.000Z',
};

describe('DirectoryAddressReviewPageComponent', () => {
  let fixture: ComponentFixture<DirectoryAddressReviewPageComponent>;
  let http: HttpTestingController;

  it('offers revocation for published candidates', () => {
    http.expectOne(`http://localhost:3000/api/directory/towns/${town}/address-review-candidates?status=needs_human&limit=25&offset=0`)
      .flush({ candidates: [{ ...candidate, status: 'published' }] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Revoke');
  });

  it('loads archived candidates when the reviewer selects Archived', () => {
    http.expectOne(`http://localhost:3000/api/directory/towns/${town}/address-review-candidates?status=needs_human&limit=25&offset=0`).flush({ candidates: [] });
    fixture.componentInstance.setStatus('archived');
    http.expectOne(`http://localhost:3000/api/directory/towns/${town}/address-review-candidates?status=archived&limit=25&offset=0`).flush({ candidates: [{ ...candidate, status: 'archived' }] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Fixture Bakery');
    expect(fixture.componentInstance.canRevoke({ ...candidate, status: 'archived' } as never)).toBe(false);
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        DirectoryAddressReviewPageComponent,
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: API_BASE_URL, useValue: 'http://localhost:3000/api' },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ communityId: town })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DirectoryAddressReviewPageComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('loads the human review queue', () => {
    const request = http.expectOne(
      `http://localhost:3000/api/directory/towns/${town}/address-review-candidates?status=needs_human&limit=25&offset=0`
    );
    request.flush({ candidates: [candidate] });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Fixture Bakery');
    expect(fixture.nativeElement.textContent).toContain('10 Main St');
    expect(fixture.nativeElement.textContent).toContain('rights');
  });

  it('records a human decision and refreshes the queue', () => {
    const initial = http.expectOne(
      `http://localhost:3000/api/directory/towns/${town}/address-review-candidates?status=needs_human&limit=25&offset=0`
    );
    initial.flush({ candidates: [candidate] });
    fixture.detectChanges();

    fixture.componentInstance.decide(
      candidate as never,
      'needs_info',
      '',
      true,
      'Address needs a clearer source'
    );

    const decision = http.expectOne(
      `http://localhost:3000/api/directory/towns/${town}/address-review-candidates/${candidate.id}/decisions`
    );
    expect(decision.request.method).toBe('POST');
    expect(decision.request.body).toEqual({
      decision: 'needs_info',
      evidenceUrl: '',
      reason: 'Address needs a clearer source',
      attested: true,
      checks: { reviewedFrom: 'owner-console' },
    });
    decision.flush({ recorded: true, status: 'needs_human' });

    const refresh = http.expectOne(
      `http://localhost:3000/api/directory/towns/${town}/address-review-candidates?status=needs_human&limit=25&offset=0`
    );
    refresh.flush({ candidates: [] });
    fixture.detectChanges();

    expect(fixture.componentInstance.message).toContain(
      'Recorded needs info for Fixture Bakery'
    );
  });

  it('does not submit an approval without an attestation or evidence', () => {
    const initial = http.expectOne(
      `http://localhost:3000/api/directory/towns/${town}/address-review-candidates?status=needs_human&limit=25&offset=0`
    );
    initial.flush({ candidates: [candidate] });
    fixture.detectChanges();

    fixture.componentInstance.decide(
      candidate as never,
      'approve',
      '',
      false,
      ''
    );
    expect(fixture.componentInstance.message).toContain('Confirm');
    expect(() =>
      http.expectNone(
        `http://localhost:3000/api/directory/towns/${town}/address-review-candidates/${candidate.id}/decisions`
      )
    ).not.toThrow();
  });
});
