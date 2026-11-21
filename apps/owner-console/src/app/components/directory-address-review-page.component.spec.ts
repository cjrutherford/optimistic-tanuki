import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import {
  DirectoryAddressReviewPageComponent,
  STALE_MESSAGE,
} from './directory-address-review-page.component';

const vt = 'a'.repeat(64);
const vt2 = 'b'.repeat(64);
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
  versionToken: vt,
  createdAt: '2026-11-10T00:00:00.000Z',
  updatedAt: '2026-11-10T00:00:00.000Z',
};

describe('DirectoryAddressReviewPageComponent', () => {
  let fixture: ComponentFixture<DirectoryAddressReviewPageComponent>;
  let http: HttpTestingController;

  it('offers revocation for published candidates', () => {
    http
      .expectOne(
        `http://localhost:3000/api/directory/towns/${town}/address-review-candidates?status=needs_human&limit=25&offset=0`
      )
      .flush({ candidates: [{ ...candidate, status: 'published' }] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Revoke');
  });

  it('loads archived candidates when the reviewer selects Archived', () => {
    http
      .expectOne(
        `http://localhost:3000/api/directory/towns/${town}/address-review-candidates?status=needs_human&limit=25&offset=0`
      )
      .flush({ candidates: [] });
    fixture.componentInstance.setStatus('archived');
    http
      .expectOne(
        `http://localhost:3000/api/directory/towns/${town}/address-review-candidates?status=archived&limit=25&offset=0`
      )
      .flush({ candidates: [{ ...candidate, status: 'archived' }] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Fixture Bakery');
    expect(
      fixture.componentInstance.canRevoke({
        ...candidate,
        status: 'archived',
      } as never)
    ).toBe(false);
  });

  beforeEach(async () => {
    let n = 0;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        randomUUID: () =>
          `d0000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      },
    });
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
    const sent = decision.request.body;
    expect(sent.decisionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent.expectedVersionToken).toBe(vt);
    expect(sent).toEqual({
      decisionId: sent.decisionId,
      expectedVersionToken: vt,
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

  const queueUrl = `http://localhost:3000/api/directory/towns/${town}/address-review-candidates?status=needs_human&limit=25&offset=0`;
  const itemUrl = `http://localhost:3000/api/directory/towns/${town}/address-review-candidates/${candidate.id}`;

  it('on a 409 says the item changed and reloads the queue', () => {
    http.expectOne(queueUrl).flush({ candidates: [candidate] });
    fixture.detectChanges();
    fixture.componentInstance.decide(
      candidate as never,
      'reject',
      '',
      true,
      'no'
    );
    http
      .expectOne(`${itemUrl}/decisions`)
      .flush(
        { code: 'stale_decision' },
        { status: 409, statusText: 'Conflict' }
      );
    expect(fixture.componentInstance.message).toBe(STALE_MESSAGE);
    expect(STALE_MESSAGE).toBe('This item changed since you opened it');
    http
      .expectOne(queueUrl)
      .flush({ candidates: [{ ...candidate, versionToken: vt2 }] });
    expect(fixture.componentInstance.candidates[0].versionToken).toBe(vt2);
  });

  it('shows the history and undoes the latest decision with a fresh decision id', () => {
    http.expectOne(queueUrl).flush({ candidates: [candidate] });
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.toggleHistory(candidate as never);
    http.expectOne(itemUrl).flush({
      ...candidate,
      history: [
        {
          decisionId: 'd1',
          actorKind: 'human',
          actorId: 'r1',
          decision: 'reject',
          reason: 'bad',
          createdAt: '2026-11-17T00:00:00Z',
          undoOf: null,
          undoneBy: null,
          reversible: true,
        },
      ],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Reject');
    expect(fixture.nativeElement.textContent).toContain('Undo');
    const entry = component.historyEntries(candidate.id)[0];
    component.undo(candidate as never, { entry, reason: 'wrong shop' });
    const undo = http.expectOne(`${itemUrl}/undo`);
    expect(undo.request.method).toBe('POST');
    expect(undo.request.body.undoOf).toBe('d1');
    expect(undo.request.body.expectedVersionToken).toBe(vt);
    expect(undo.request.body.reason).toBe('wrong shop');
    expect(undo.request.body.decisionId).toMatch(/^[0-9a-f-]{36}$/);
    undo.flush({ recorded: true, status: 'needs_human' });
    http.expectOne(queueUrl).flush({ candidates: [candidate] });
    http.expectOne(itemUrl).flush({ ...candidate, history: [] });
    expect(component.message).toContain('Undid the reject decision');
  });

  it('on a 409 from an undo says the item changed', () => {
    http.expectOne(queueUrl).flush({ candidates: [candidate] });
    const component = fixture.componentInstance;
    const entry = { id: 'd1', label: 'Reject', actor: 'r1', at: 'x' };
    component.undo(candidate as never, { entry, reason: 'why' });
    http
      .expectOne(`${itemUrl}/undo`)
      .flush({ code: 'not_latest' }, { status: 409, statusText: 'Conflict' });
    expect(component.message).toBe(STALE_MESSAGE);
    http.expectOne(queueUrl).flush({ candidates: [candidate] });
  });
});
