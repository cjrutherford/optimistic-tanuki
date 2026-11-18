import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import {
  DUPLICATE_STALE_MESSAGE,
  DirectoryDuplicateReviewPageComponent,
  type DuplicateCaseDetail,
  type DuplicateCaseSummary,
  type DuplicateSample,
} from './directory-duplicate-review-page.component';

const town = 'c52cfef1-9180-46ba-96d8-cca7149f9bdf';
const url = `http://localhost:3000/api/directory/towns/${town}/duplicate-cases`;
const listUrl = `${url}?state=queued&limit=25&offset=0`;
const caseId = 'b52cfef1-9180-46ba-96d8-cca7149f9bdf';

const summary: DuplicateCaseSummary = {
  caseId,
  state: 'queued',
  rule: 'similar_name',
  weakerBasis: 'fewer fields',
  distanceMeters: 40,
  keptName: 'Corner Diner',
  hiddenName: 'Corner Dinner',
  createdAt: '2026-11-10T00:00:00.000Z',
};
const view = (name: string, hidden: boolean) => ({
  name,
  category: 'restaurant',
  addresses: ['1 Main St'],
  phones: [],
  websites: [],
  sources: ['overture'],
  scanId: '7',
  sourceFileRowNumber: '12',
  hidden,
});
const detail = (state: DuplicateCaseDetail['state']): DuplicateCaseDetail => ({
  ...summary,
  state,
  decidedAt: null,
  keptListing: view('Corner Diner', false),
  hiddenListing: view('Corner Dinner', state !== 'kept_separate'),
  history: [
    {
      eventId: 'e1',
      kind: 'queued',
      actorId: null,
      note: null,
      createdAt: '2026-11-10T00:00:00.000Z',
    },
  ],
});
const report = {
  sampleSize: 200,
  judged: 200,
  unjudged: 0,
  wrong: 2,
  rate: 0.01,
  upperBound95: 0.035,
  limit: 0.02,
  withinLimit: false,
  complete: true,
};
const sample: DuplicateSample = {
  sampleId: 'a52cfef1-9180-46ba-96d8-cca7149f9bdf',
  round: '2026-q4',
  seed: 'abc',
  populationSize: 6500,
  createdAt: '2026-11-10T00:00:00.000Z',
  createdById: 'f52cfef1-9180-46ba-96d8-cca7149f9bdf',
  report,
};

describe('DirectoryDuplicateReviewPageComponent', () => {
  let fixture: ComponentFixture<DirectoryDuplicateReviewPageComponent>;
  let http: HttpTestingController;
  let component: DirectoryDuplicateReviewPageComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        DirectoryDuplicateReviewPageComponent,
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
                fn(convertToParamMap({ communityId: town })),
            },
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DirectoryDuplicateReviewPageComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  const open = () => {
    http
      .expectOne(listUrl)
      .flush({ cases: [summary], total: 6500, limit: 25, offset: 0 });
    component.toggle(component.cases[0]);
    http.expectOne(`${url}/${caseId}`).flush(detail('queued'));
    fixture.detectChanges();
  };

  it('pages the queue on the server and loads more from the offset', () => {
    http
      .expectOne(listUrl)
      .flush({ cases: [summary], total: 6500, limit: 25, offset: 0 });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Corner Diner');
    expect(fixture.nativeElement.textContent).toContain('6500 pairs match');
    expect(component.showMore()).toBe(true);
    component.loadMore();
    http.expectOne(`${url}?state=queued&limit=25&offset=1`).flush({
      cases: [{ ...summary, caseId: 'z' }],
      total: 6500,
      limit: 25,
      offset: 1,
    });
    expect(component.cases).toHaveLength(2);
  });

  it('sends the reason filter and restarts from the first page', () => {
    http
      .expectOne(listUrl)
      .flush({ cases: [], total: 0, limit: 25, offset: 0 });
    component.setRule('same_name_near');
    http
      .expectOne(`${url}?state=queued&rule=same_name_near&limit=25&offset=0`)
      .flush({ cases: [], total: 0, limit: 25, offset: 0 });
    component.setState('all');
    http
      .expectOne(`${url}?rule=same_name_near&limit=25&offset=0`)
      .flush({ cases: [], total: 0, limit: 25, offset: 0 });
  });

  it('shows both listings side by side and marks the hidden one', () => {
    open();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Kept listing');
    expect(text).toContain('Weaker listing');
    expect(text).toContain('Corner Dinner');
    expect(text).toContain('scan 7, row 12');
    expect(
      fixture.nativeElement.querySelectorAll('.pair-side.is-hidden')
    ).toHaveLength(1);
  });

  it('requires a reason, then merges against the state the reviewer saw', () => {
    open();
    component.decide(component.cases[0], 'merge', ' ');
    expect(component.message).toContain('reason');
    http.expectNone(`${url}/${caseId}/decide`);
    component.decide(component.cases[0], 'merge', ' same shop ');
    const req = http.expectOne(`${url}/${caseId}/decide`);
    expect(req.request.body).toEqual({
      action: 'merge',
      reason: 'same shop',
      expectedState: 'queued',
    });
    req.flush({ recorded: true, replayed: false, state: 'merged' });
    http.expectOne(`${url}/${caseId}`).flush(detail('merged'));
    expect(component.cases[0].state).toBe('merged');
    expect(component.message).toBe('Decision recorded.');
  });

  it('reloads the pair when a decision loses a race', () => {
    open();
    component.decide(component.cases[0], 'keep_separate', 'different shops');
    http
      .expectOne(`${url}/${caseId}/decide`)
      .flush({ code: 'stale' }, { status: 409, statusText: 'Conflict' });
    expect(component.message).toBe(DUPLICATE_STALE_MESSAGE);
    http.expectOne(`${url}/${caseId}`).flush(detail('merged'));
    expect(component.cases[0].state).toBe('merged');
  });

  it('offers undo only on a decided pair and sends the undo action', () => {
    open();
    expect(component.historyEntries(caseId).every((h) => !h.reversible)).toBe(
      true
    );
    http.expectNone(`${url}/${caseId}/decide`);
    const decided = detail('merged');
    decided.history.push({
      eventId: 'e2',
      kind: 'merged',
      actorId: 'f52cfef1-9180-46ba-96d8-cca7149f9bdf',
      note: 'same shop',
      createdAt: '2026-11-11T00:00:00.000Z',
    });
    component['details'] = { [caseId]: decided };
    const entries = component.historyEntries(caseId);
    expect(entries[1].reversible).toBe(true);
    expect(entries[0].reversible).toBe(false);
    component.undo(
      { ...summary, state: 'merged' },
      { entry: entries[1], reason: 'mistake' }
    );
    const req = http.expectOne(`${url}/${caseId}/decide`);
    expect(req.request.body).toEqual({
      action: 'undo',
      reason: 'mistake',
      expectedState: 'merged',
    });
    req.flush({ recorded: true, replayed: false, state: 'queued' });
    http.expectOne(`${url}/${caseId}`).flush(detail('queued'));
  });

  it('draws a sample, shows its report and judges a pair', () => {
    http
      .expectOne(listUrl)
      .flush({ cases: [], total: 0, limit: 25, offset: 0 });
    component.setTab('sample');
    http.expectOne(`${url}/samples`).flush({ samples: [] });
    component.draw('', '', '');
    expect(component.message).toContain('round');
    component.draw('2026-q4', '5000', '');
    expect(component.message).toContain('1 to 1000');
    component.draw('2026-q4', '200', 'abc');
    const post = http.expectOne(`${url}/samples`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({
      round: '2026-q4',
      size: 200,
      seed: 'abc',
    });
    post.flush({ replayed: false, sample });
    http.expectOne(`${url}/samples`).flush({ samples: [sample] });
    http.expectOne(`${url}/samples/${sample.sampleId}`).flush({
      sample,
      items: [
        {
          caseId,
          state: 'merged',
          rule: 'similar_name',
          distanceMeters: 40,
          keptName: 'A',
          hiddenName: 'B',
          verdict: null,
          judgedAt: null,
        },
      ],
    });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Round 2026-q4');
    expect(text).toContain('1.00%');
    expect(text).toContain('2.00%');
    expect(text).toContain('Over limit');
    component.judge(component.openSample!.items[0], 'distinct');
    const judge = http.expectOne(`${url}/samples/${sample.sampleId}/judge`);
    expect(judge.request.body).toEqual({ caseId, verdict: 'distinct' });
    judge.flush({ replayed: false, report });
    http
      .expectOne(`${url}/samples/${sample.sampleId}`)
      .flush({ sample, items: [] });
    http.expectOne(`${url}/samples`).flush({ samples: [sample] });
  });
});
