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
  DirectoryIdentityReviewPageComponent,
  STALE_MESSAGE,
} from './directory-identity-review-page.component';

const town = '615482e8-d72b-4500-989f-5b79ceb32781';
const a = 'b52cfef1-9180-46ba-96d8-cca7149f9bdf';
const b = 'c52cfef1-9180-46ba-96d8-cca7149f9bdf';
const scan = 'a'.repeat(64);
const vt = 'a'.repeat(64);
const vt2 = 'b'.repeat(64);
const url = `http://localhost:3000/api/directory/towns/${town}/business-identity-review`;
const queue = {
  health: {
    unresolved: 1,
    absent: 0,
    awaitingOwner: 1,
    carryIncomplete: 0,
    carriedUnbound: 2,
  },
  queue: {
    carriedUnbound: [
      {
        businessId: a,
        scanId: scan,
        sourceFileRowNumber: '4',
        versionToken: vt,
      },
      {
        businessId: a,
        scanId: scan,
        sourceFileRowNumber: '5',
        versionToken: vt,
      },
    ],
    unresolved: [
      {
        businessId: b,
        scanId: 'scan-1',
        sourceFileRowNumber: '9',
        versionToken: vt2,
        cause: 'duplicate_key',
      },
    ],
    awaitingOwner: [
      { carryId: a, requestId: b, businessId: a, versionToken: vt },
    ],
  },
};

describe('DirectoryIdentityReviewPageComponent', () => {
  let fixture: ComponentFixture<DirectoryIdentityReviewPageComponent>;
  let component: DirectoryIdentityReviewPageComponent;
  let http: HttpTestingController;
  let ids: string[];

  beforeEach(async () => {
    ids = [
      'd0000000-0000-4000-8000-000000000001',
      'd0000000-0000-4000-8000-000000000002',
      'd0000000-0000-4000-8000-000000000003',
    ];
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: () => ids.shift() },
    });
    await TestBed.configureTestingModule({
      imports: [
        DirectoryIdentityReviewPageComponent,
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: API_BASE_URL, useValue: 'http://localhost:3000/api' },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ communityId: town })) },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DirectoryIdentityReviewPageComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(url).flush(queue);
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    http.verify();
  });

  const fill = (reason = 'reviewed', attested = true) => {
    component.setReason(reason);
    component.setAttested(attested);
  };
  const submitOk = (body: object) => {
    const req = http.expectOne(`${url}/decisions`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    return req;
  };

  it('renders health, the three sections and read-only awaiting owner', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Carried, unbound');
    expect(text).toContain('duplicate key');
    expect(text).toContain('Awaiting owner');
    expect(text).toContain('restores these owner links');
    expect(component.businesses()).toEqual([a, b]);
  });

  it('posts confirm', () => {
    component.open(a, 'confirm');
    fill();
    component.submit();
    submitOk({
      decisionId: 'd0000000-0000-4000-8000-000000000001',
      expectedVersionToken: vt,
      action: 'confirm',
      businessId: a,
      reason: 'reviewed',
      attested: true,
    }).flush({
      recorded: true,
      replayed: false,
      businesses: 1,
      restoredLinks: 1,
    });
    http.expectOne(url).flush(queue);
    expect(component.message).toContain('Recorded confirm');
  });

  it('posts retire', () => {
    component.open(a, 'retire');
    fill('closed down');
    component.submit();
    submitOk({
      decisionId: 'd0000000-0000-4000-8000-000000000001',
      expectedVersionToken: vt,
      action: 'retire',
      businessId: a,
      reason: 'closed down',
      attested: true,
    }).flush({
      recorded: true,
      replayed: false,
      businesses: 1,
      restoredLinks: 0,
    });
    http.expectOne(url).flush(queue);
  });

  it('posts merge with another queue entry or a pasted id', () => {
    component.open(a, 'merge');
    fill();
    component.submit();
    expect(component.message).toContain('different business');
    component.setOther(` ${b} `);
    component.submit();
    submitOk({
      decisionId: 'd0000000-0000-4000-8000-000000000001',
      expectedVersionToken: vt,
      action: 'merge',
      businessId: a,
      otherBusinessId: b,
      reason: 'reviewed',
      attested: true,
    }).flush({
      recorded: true,
      replayed: false,
      businesses: 2,
      restoredLinks: 0,
    });
    http.expectOne(url).flush(queue);
  });

  it('posts split with the ticked rows', () => {
    component.open(a, 'split');
    fill();
    component.submit();
    expect(component.message).toContain('at least one row');
    component.toggleRow(queue.queue.carriedUnbound[1], true);
    component.submit();
    submitOk({
      decisionId: 'd0000000-0000-4000-8000-000000000001',
      expectedVersionToken: vt,
      action: 'split',
      businessId: a,
      rows: [{ scanId: scan, sourceFileRowNumber: '5' }],
      reason: 'reviewed',
      attested: true,
    }).flush({
      recorded: true,
      replayed: false,
      businesses: 2,
      restoredLinks: 0,
    });
    http.expectOne(url).flush(queue);
  });

  it('requires a reason and the attestation before posting', () => {
    component.open(a, 'confirm');
    component.submit();
    expect(component.message).toContain('reason');
    fill('ok', false);
    component.submit();
    expect(component.message).toContain('Confirm that you reviewed');
    http.expectNone(`${url}/decisions`);
  });

  it('reuses the decisionId when the same form is retried after a failure', () => {
    component.open(a, 'confirm');
    fill();
    component.submit();
    const first = http.expectOne(`${url}/decisions`);
    first.flush('', { status: 503, statusText: 'Unavailable' });
    expect(component.message).toContain('unavailable');
    component.submit();
    const second = http.expectOne(`${url}/decisions`);
    expect(second.request.body.decisionId).toBe(first.request.body.decisionId);
    second.flush({
      recorded: true,
      replayed: true,
      businesses: 1,
      restoredLinks: 0,
    });
    http.expectOne(url).flush(queue);
    expect(component.message).toContain('already recorded');
  });

  it('shows the refusal message for a 409 and keeps the form open', () => {
    component.open(a, 'retire');
    fill();
    component.submit();
    http
      .expectOne(`${url}/decisions`)
      .flush('', { status: 409, statusText: 'Conflict' });
    expect(component.message).toBe(
      'Refused — an owner link may be attached or the business is no longer active.'
    );
    expect(component.form).not.toBeNull();
  });

  it('on a stale_decision 409 says the item changed, closes the form and reloads', () => {
    component.open(a, 'retire');
    fill();
    component.submit();
    http
      .expectOne(`${url}/decisions`)
      .flush(
        { code: 'stale_decision' },
        { status: 409, statusText: 'Conflict' }
      );
    expect(component.message).toBe(STALE_MESSAGE);
    expect(STALE_MESSAGE).toBe('This item changed since you opened it');
    expect(component.form).toBeNull();
    http.expectOne(url).flush(queue);
  });

  const detail = (reversible = true) => ({
    businessId: a,
    state: 'retired',
    successorId: null,
    stateCause: 'reviewer_retire',
    versionToken: vt2,
    history: [
      {
        decisionId: 'e0000000-0000-4000-8000-000000000001',
        action: 'retire',
        businessId: a,
        otherBusinessId: null,
        actorId: 'reviewer-1',
        actorDomain: 'profile',
        reason: 'closed',
        createdAt: '2026-11-17T00:00:00Z',
        undoOf: null,
        undoneBy: null,
        reversible,
      },
    ],
  });

  it('opens the history and undoes the latest decision with the detail token', () => {
    component.toggleHistory(a);
    http.expectOne(`${url}/${a}`).flush(detail());
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Retire');
    expect(fixture.nativeElement.textContent).toContain('Undo');
    const [entry] = component.historyEntries(a);
    expect(entry.reversible).toBe(true);
    component.undo(a, { entry, reason: 'wrong shop' });
    const req = http.expectOne(`${url}/${a}/undo`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      decisionId: 'd0000000-0000-4000-8000-000000000001',
      undoOf: 'e0000000-0000-4000-8000-000000000001',
      expectedVersionToken: vt2,
      reason: 'wrong shop',
    });
    req.flush({ recorded: true, replayed: false });
    http.expectOne(url).flush(queue);
    http.expectOne(`${url}/${a}`).flush(detail(false));
    expect(component.message).toContain('Undid the retire decision');
  });

  it('on a 409 from an undo says the item changed and reloads', () => {
    component.toggleHistory(a);
    http.expectOne(`${url}/${a}`).flush(detail());
    const [entry] = component.historyEntries(a);
    component.undo(a, { entry, reason: 'why' });
    http
      .expectOne(`${url}/${a}/undo`)
      .flush({ code: 'not_latest' }, { status: 409, statusText: 'Conflict' });
    expect(component.message).toBe(STALE_MESSAGE);
    http.expectOne(url).flush(queue);
    http.expectOne(`${url}/${a}`).flush(detail());
  });
});
