import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import type { AcquisitionRunDetail } from '@optimistic-tanuki/social-contracts';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import {
  ACQUISITION_POLL_MS,
  DirectoryAcquisitionRunsPageComponent,
} from './directory-acquisition-runs-page.component';

const base = 'http://localhost:3000/api/directory/runs';
const listUrl = `${base}?limit=25`;
const token = 'b'.repeat(64);
const runId = 'd0000000-0000-4000-8000-0000000000aa';
const summary = (over: Record<string, unknown> = {}) => ({
  id: runId,
  provider: 'overture',
  release: '2026-10-15',
  kind: 'overture-stage',
  townIds: [],
  status: 'partial',
  blockedReason: null,
  startedBy: 'system',
  startedById: null,
  reason: 'stage',
  createdAt: '2026-11-10T00:00:00.000Z',
  startedAt: null,
  heartbeatAt: null,
  finishedAt: null,
  stale: false,
  observed: 12,
  accepted: 10,
  rejected: 2,
  budgetReservedCents: 0,
  budgetUsedCents: 0,
  lastError: null,
  ...over,
});
const job = (over: Record<string, unknown> = {}) => ({
  unitKey: 'asset-1',
  townId: null,
  scanId: null,
  status: 'failed_retryable',
  blockedReason: null,
  checkpoint: null,
  attempt: 1,
  observed: 5,
  accepted: 4,
  rejected: 1,
  lastError: 'network',
  startedAt: null,
  finishedAt: null,
  updatedAt: '2026-11-10T00:00:00.000Z',
  ...over,
});
const detail = (over: Record<string, unknown> = {}) => ({
  ...summary(),
  jobs: [job(), job({ unitKey: 'asset-2', status: 'succeeded' })],
  events: [],
  completeness: { done: 1, total: 2 },
  versionToken: token,
  pendingRequest: false,
  resumeCommand: null,
  ...over,
});
const budget = {
  period: '2026-11',
  ceilingCents: 2500,
  reservedCents: 100,
  usedCents: 40,
  remainingCents: 2400,
  anonymousAttempts: 3,
  hardStop: false,
  acquisitionAuthorized: false,
};

describe('DirectoryAcquisitionRunsPageComponent', () => {
  let fixture: ComponentFixture<DirectoryAcquisitionRunsPageComponent>;
  let http: HttpTestingController;
  let component: DirectoryAcquisitionRunsPageComponent;

  beforeEach(async () => {
    jest.useFakeTimers();
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
        DirectoryAcquisitionRunsPageComponent,
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: API_BASE_URL, useValue: 'http://localhost:3000/api' },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DirectoryAcquisitionRunsPageComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`${base}/budget`).flush(budget);
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    jest.useRealTimers();
  });

  const open = () => {
    http
      .expectOne(listUrl)
      .flush({ runs: [summary({ blockedReason: null })], total: 1 });
    component.select(component.runs[0]);
    http.expectOne(`${base}/${runId}`).flush(detail());
    fixture.detectChanges();
  };

  it('shows the budget panel and blocked reasons in the list', () => {
    http.expectOne(listUrl).flush({
      runs: [
        summary({
          status: 'blocked',
          blockedReason: 'acquisition_unauthorized',
        }),
      ],
      total: 1,
    });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Reserved 100 of 2500 cents');
    expect(text).toContain('Acquisition is not authorised');
    expect(text).toContain('Blocked: acquisition unauthorized');
  });

  it('shows per-unit progress and offers a retry for a failed unit only', () => {
    open();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('1 of 2 units finished');
    expect(text).toContain('asset-1');
    expect(
      component.canRetry(component.selected!, component.selected!.jobs[0])
    ).toBe(true);
    expect(
      component.canRetry(component.selected!, component.selected!.jobs[1])
    ).toBe(false);
  });

  it('will not resume without the typed word and a reason, then sends the token and one id', () => {
    open();
    component.act('resume', 'go');
    expect(component.message).toContain('RESUME');
    component.setTyped('RESUME');
    component.act('resume', ' ');
    expect(component.message).toContain('reason');
    http.expectNone(`${base}/${runId}/resume`);
    component.act('resume', ' go ');
    const first = http.expectOne(`${base}/${runId}/resume`);
    expect(first.request.body).toMatchObject({
      reason: 'go',
      expectedVersionToken: token,
      confirm: 'RESUME',
    });
    first.error(new ProgressEvent('error'));
    component.setTyped('RESUME');
    component.act('resume', 'go');
    const again = http.expectOne(`${base}/${runId}/resume`);
    expect(again.request.body.decisionId).toBe(first.request.body.decisionId);
    again.flush({
      replayed: false,
      run: detail({
        status: 'queued',
        pendingRequest: true,
        resumeCommand: 'node scripts/x.cjs --resume y',
      }),
      resumeCommand: 'node scripts/x.cjs --resume y',
    });
    expect(component.command).toContain('--resume');
    expect(component.typed).toBe('');
    http.expectOne(`${base}/budget`).flush(budget);
    http.expectOne(listUrl).flush({ runs: [], total: 0 });
    http.expectOne(`${base}/${runId}`).flush(detail({ status: 'queued' }));
  });

  it('retries one unit by key', () => {
    open();
    component.setTyped('RETRY');
    component.act('retry', 'again', 'asset-1');
    const req = http.expectOne(`${base}/${runId}/retry`);
    expect(req.request.body).toMatchObject({
      unitKey: 'asset-1',
      confirm: 'RETRY',
    });
    req.flush({ replayed: false, run: detail(), resumeCommand: null });
    http.expectOne(`${base}/budget`).flush(budget);
    http.expectOne(listUrl).flush({ runs: [], total: 0 });
    http.expectOne(`${base}/${runId}`).flush(detail());
  });

  it('explains a blocked refusal and a stale token, and reloads the run', () => {
    open();
    component.setTyped('RESUME');
    component.act('resume', 'go');
    http
      .expectOne(`${base}/${runId}/resume`)
      .flush(
        { code: 'run_blocked', reason: 'quota_exhausted' },
        { status: 409, statusText: 'Conflict' }
      );
    expect(component.message).toContain('quota is exhausted');
    http.expectOne(`${base}/${runId}`).flush(detail());
    component.setTyped('RESUME');
    component.act('resume', 'go');
    http
      .expectOne(`${base}/${runId}/resume`)
      .flush(
        { code: 'stale_decision' },
        { status: 409, statusText: 'Conflict' }
      );
    expect(component.message).toContain('changed since you opened it');
    http.expectOne(`${base}/${runId}`).flush(detail());
  });

  it('does not offer a resume that the run cannot take', () => {
    open();
    const blocked = detail({
      status: 'blocked',
      blockedReason: 'acquisition_unauthorized',
    }) as unknown as AcquisitionRunDetail;
    expect(component.resumeBlock(blocked)).toContain('not authorised');
    const historical = detail({
      kind: 'historical',
    }) as unknown as AcquisitionRunDetail;
    expect(component.resumeBlock(historical)).toContain('history');
    expect(component.canRetry(historical, historical.jobs[0])).toBe(false);
  });

  it('refreshes while a run is in flight and stops once it ends', () => {
    http.expectOne(listUrl).flush({
      runs: [summary({ status: 'running' })],
      total: 1,
    });
    expect(component.inFlight()).toBe(true);
    jest.advanceTimersByTime(ACQUISITION_POLL_MS);
    http.expectOne(`${base}/budget`).flush(budget);
    http.expectOne(listUrl).flush({
      runs: [summary({ status: 'succeeded' })],
      total: 1,
    });
    expect(component.inFlight()).toBe(false);
    jest.advanceTimersByTime(ACQUISITION_POLL_MS * 2);
    http.expectNone(listUrl);
  });

  it('imports history with a reason and reports the counts', () => {
    http.expectOne(listUrl).flush({ runs: [], total: 0 });
    component.importHistory(' ');
    expect(component.message).toContain('reason');
    component.importHistory('backfill');
    const req = http.expectOne(`${base}/history/import`);
    expect(req.request.body).toMatchObject({ reason: 'backfill' });
    req.flush({ replayed: false, created: 4, existing: 1 });
    expect(component.message).toContain('4 added');
    http.expectOne(listUrl).flush({ runs: [], total: 0 });
  });
  it('asks for a town run now only with a town id, a reason and RUN', () => {
    const town = '77777777-7777-4777-8777-777777777777';
    http.expectOne(listUrl).flush({ runs: [], total: 0 });
    component.runTownNow('nope', 'why', 'RUN');
    expect(component.message).toContain('town id');
    component.runTownNow(town, ' ', 'RUN');
    expect(component.message).toContain('reason');
    component.runTownNow(town, 'why', 'run');
    expect(component.message).toContain('RUN');
    http.expectNone(`${base}/towns/${town}/run`);
    component.runTownNow(town, 'why', 'RUN');
    const req = http.expectOne(`${base}/towns/${town}/run`);
    expect(req.request.body).toMatchObject({ reason: 'why', confirm: 'RUN' });
    req.flush({
      communityId: town,
      replayed: false,
      alreadyPending: true,
      requestedAt: '2026-11-18T00:00:00.000Z',
      providers: ['overture'],
    });
    expect(component.message).toContain('already has a pending request');
    expect(component.busy).toBe(false);
  });
});
