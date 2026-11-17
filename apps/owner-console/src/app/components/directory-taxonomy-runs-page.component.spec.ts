import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import {
  DirectoryTaxonomyRunsPageComponent,
  TAXONOMY_POLL_MS,
} from './directory-taxonomy-runs-page.component';

const base = 'http://localhost:3000/api/directory/taxonomy';
const runsUrl = `${base}/runs?limit=25`;
const hash = 'c'.repeat(64);
const run = (over: Record<string, unknown> = {}) => ({
  id: 'd0000000-0000-4000-8000-0000000000aa',
  mappingVersion: 'v1',
  scope: 'town',
  townId: 'e0000000-0000-4000-8000-0000000000bb',
  mode: 'dry_run',
  phase: 'plan',
  status: 'complete',
  actorId: '11111111-1111-4111-8111-111111111111',
  reason: 'plan',
  expectedPlanHash: null,
  planHash: hash,
  scannedRows: 5,
  changedRows: 3,
  appliedRows: 0,
  restoredRows: 0,
  attempts: 0,
  cancelRequested: false,
  summary: {
    transitions: [
      {
        from: 'bar',
        to: 'restaurants',
        count: 3,
        samples: [{ scanId: 's', row: '1', name: 'Plain Bar' }],
      },
    ],
    unchanged: 2,
    unmapped: 1,
    excluded: 0,
    truncatedTransitions: 0,
  },
  lastError: null,
  createdAt: '2026-11-10T00:00:00.000Z',
  updatedAt: '2026-11-10T00:00:00.000Z',
  completedAt: '2026-11-10T00:01:00.000Z',
  ...over,
});
const mappings = {
  versions: [
    {
      id: 'v1',
      active: true,
      rowCount: 60,
      sourceHash: 'h',
      unmappedPolicy: 'keep_legacy',
      installedById: null,
      createdAt: '',
      activatedAt: '',
    },
  ],
  available: [{ id: 'v1', installed: true }],
};

describe('DirectoryTaxonomyRunsPageComponent', () => {
  let fixture: ComponentFixture<DirectoryTaxonomyRunsPageComponent>;
  let http: HttpTestingController;
  let component: DirectoryTaxonomyRunsPageComponent;

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
        DirectoryTaxonomyRunsPageComponent,
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: API_BASE_URL, useValue: 'http://localhost:3000/api' },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DirectoryTaxonomyRunsPageComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`${base}/mappings`).flush(mappings);
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    jest.useRealTimers();
  });

  it('shows the dry-run diff and defaults to the active version', () => {
    http.expectOne(runsUrl).flush({ runs: [run()] });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(component.version).toBe('v1');
    expect(text).toContain('Plain Bar');
    expect(text).toContain('restaurants');
    expect(text).toContain('2 unchanged');
  });

  it('will not apply without the typed confirmation, then applies the named plan', () => {
    http.expectOne(runsUrl).flush({ runs: [run()] });
    const r = component.runs[0];
    component.setTyped(r.id, 'apply');
    component.apply(r, 'go');
    expect(component.message).toContain('APPLY');
    http.expectNone(`${base}/runs`);
    component.setTyped(r.id, 'APPLY');
    component.apply(r, ' go ');
    const req = http.expectOne(`${base}/runs`);
    expect(req.request.body).toMatchObject({
      mode: 'apply',
      scope: 'town',
      townId: r.townId,
      mappingVersion: 'v1',
      expectedPlanHash: hash,
      confirm: 'APPLY',
      reason: 'go',
    });
    req.flush({ replayed: false, run: run({ mode: 'apply' }) });
    expect(component.typed[r.id]).toBe('');
    http.expectOne(runsUrl).flush({ runs: [] });
  });

  it('starts a dry run with one id per attempt and requires a town for a town run', () => {
    http.expectOne(runsUrl).flush({ runs: [] });
    component.dryRun('', 'why');
    expect(component.message).toContain('required');
    http.expectNone(`${base}/runs`);
    component.dryRun('t', 'why');
    const first = http.expectOne(`${base}/runs`);
    expect(first.request.body).toMatchObject({ mode: 'dry_run', townId: 't' });
    expect(first.request.body.confirm).toBeUndefined();
    first.error(new ProgressEvent('error'));
    component.dryRun('t', 'why');
    const retry = http.expectOne(`${base}/runs`);
    expect(retry.request.body.id).toBe(first.request.body.id);
    retry.flush({ replayed: false, run: run() });
    http.expectOne(runsUrl).flush({ runs: [run()] });
    component.setScope('all');
    component.dryRun('', 'why');
    const all = http.expectOne(`${base}/runs`);
    expect(all.request.body.townId).toBeUndefined();
    expect(all.request.body.scope).toBe('all');
    all.flush({ replayed: false, run: run() });
    http.expectOne(runsUrl).flush({ runs: [] });
  });

  it('follows progress while running and cancels with a reason', () => {
    http.expectOne(runsUrl).flush({
      runs: [
        run({
          mode: 'apply',
          phase: 'apply',
          status: 'running',
          changedRows: 10,
          appliedRows: 4,
          planHash: hash,
        }),
      ],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('4 of 10 rows applied');
    component.cancel(component.runs[0], ' ');
    expect(component.message).toContain('reason');
    component.cancel(component.runs[0], 'stop');
    http
      .expectOne(`${base}/runs/${component.runs[0].id}/cancel`)
      .flush({ replayed: false, run: run({ cancelRequested: true }) });
    http.expectOne(runsUrl).flush({
      runs: [run({ mode: 'apply', status: 'running', cancelRequested: true })],
    });
    jest.advanceTimersByTime(TAXONOMY_POLL_MS);
    http.expectOne(runsUrl).flush({
      runs: [run({ mode: 'apply', status: 'canceled' })],
    });
    jest.advanceTimersByTime(TAXONOMY_POLL_MS * 3);
    http.expectNone(runsUrl);
  });

  it('rolls back a completed apply only after the typed word', () => {
    http.expectOne(runsUrl).flush({
      runs: [run({ mode: 'apply', phase: 'apply', appliedRows: 3 })],
    });
    const r = component.runs[0];
    expect(component.canRollback(r)).toBe(true);
    expect(component.canApply(r)).toBe(false);
    component.rollback(r, 'oops');
    expect(component.message).toContain('ROLLBACK');
    component.setTyped(r.id, 'ROLLBACK');
    component.rollback(r, 'oops');
    const req = http.expectOne(`${base}/runs/${r.id}/rollback`);
    expect(req.request.body).toEqual({ reason: 'oops', confirm: 'ROLLBACK' });
    req.flush({ replayed: false, run: run({ status: 'rolling_back' }) });
    http.expectOne(runsUrl).flush({ runs: [] });
  });

  it('installs and activates a mapping version', () => {
    http.expectOne(runsUrl).flush({ runs: [] });
    component.install(true);
    const req = http.expectOne(`${base}/mappings/install`);
    expect(req.request.body).toEqual({ version: 'v1', activate: true });
    req.flush({ replayed: true, version: mappings.versions[0] });
    http.expectOne(`${base}/mappings`).flush(mappings);
    expect(component.message).toContain('already installed');
  });
});
