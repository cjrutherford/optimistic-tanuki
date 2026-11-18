import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { DirectoryOperationsPageComponent } from './directory-operations-page.component';

const base = 'http://localhost:3000/api/directory/operations';
const queue = {
  queued: 3,
  running: 1,
  failedLast24h: 2,
  oldestQueuedSeconds: null,
};
const metrics = (over: Record<string, unknown> = {}) => ({
  generatedAt: '2026-11-17T00:00:00.000Z',
  infrastructure: {
    database: 'ok',
    postgis: true,
    migrationsApplied: 12,
    latestMigration: 'M12',
    exportStorage: 'configured',
  },
  towns: { total: 40, onboarded: 7, byStatus: { live: 7 } },
  coverage: { townsWithListings: 6, publishedListings: 321 },
  freshness: {
    refreshDueListings: 5,
    staleListings: 4,
    unknownFreshnessListings: 7,
    oldestListingAgeDays: 90,
  },
  policy: {
    activePolicies: 9,
    revokedPolicies: 1,
    publicationPaused: false,
    openRightsCases: 2,
    openTaxonomyCases: 3,
  },
  spend: {
    period: '2026-11',
    reservedCents: 1000,
    limitCents: 2500,
    alertCents: 2000,
    alert: false,
    exhausted: false,
  },
  queues: { export: queue, taxonomy: queue, withdrawal: queue },
  controls: null,
  errors: [],
  ...over,
});
const control = (key: string, over: Record<string, unknown> = {}) => ({
  key,
  paused: false,
  reason: null,
  version: 0,
  updatedBy: null,
  updatedAt: null,
  ...over,
});
const controls = (over: Record<string, Record<string, unknown>> = {}) => ({
  controls: ['provider_acquisition', 'export_worker', 'taxonomy_worker'].map(
    (k) => control(k, over[k])
  ),
});

describe('DirectoryOperationsPageComponent', () => {
  let fixture: ComponentFixture<DirectoryOperationsPageComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        DirectoryOperationsPageComponent,
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: API_BASE_URL, useValue: 'http://localhost:3000/api' },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DirectoryOperationsPageComponent);
    http = TestBed.inject(HttpTestingController);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const load = (m: object = metrics(), c: object = controls()) => {
    http.expectOne(`${base}/metrics`).flush(m);
    http.expectOne(`${base}/controls`).flush(c);
    fixture.detectChanges();
  };
  const text = () => el.textContent as string;
  const button = (label: string) =>
    el.querySelector(`button[aria-label="${label}"]`) as HTMLElement;
  const click = (label: string) => {
    (button(label).querySelector('button') ?? button(label)).click();
    fixture.detectChanges();
  };
  const type = (id: string, value: string) => {
    const area = el.querySelector(`#${id}`) as HTMLTextAreaElement;
    area.value = value;
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('renders the heading, metric sections and controls', () => {
    load();
    const section = el.querySelector(
      'section[aria-labelledby="operations-title"]'
    );
    expect(section?.querySelector('h2#operations-title')?.textContent).toBe(
      'Operations'
    );
    for (const id of [
      'infrastructure',
      'towns',
      'coverage',
      'freshness',
      'policy',
      'spend',
      'queues',
    ])
      expect(
        el.querySelector(`section[aria-labelledby="m-${id}"]`)
      ).toBeTruthy();
    expect(text()).toContain('321');
    expect(text()).toContain('Provider acquisition');
    expect(text()).toContain('Export worker');
    expect(text()).toContain('Taxonomy worker');
    expect(text()).toContain('Running');
    expect(text()).toContain('cannot be paused');
    expect(text()).not.toContain('Unavailable');
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows a null section as Unavailable and lists errors', () => {
    load(metrics({ coverage: null, errors: ['coverage'] }));
    const card = el.querySelector('section[aria-labelledby="m-coverage"]');
    expect(card?.textContent).toContain('Unavailable');
    expect(el.querySelector('.metric-errors')?.textContent).toContain(
      'coverage'
    );
  });

  it('shows reserved against the limit and an alert when spend alerts', () => {
    load(
      metrics({
        spend: {
          period: '2026-11',
          reservedCents: 2200,
          limitCents: 2500,
          alertCents: 2000,
          alert: true,
          exhausted: false,
        },
      })
    );
    expect(text()).toContain('$22.00 of $25.00 reserved');
    expect(el.querySelector('.spend-alert')?.getAttribute('role')).toBe(
      'alert'
    );
  });

  it('alerts when spend is exhausted', () => {
    load(
      metrics({
        spend: {
          period: '2026-11',
          reservedCents: 2500,
          limitCents: 2500,
          alertCents: 2000,
          alert: true,
          exhausted: true,
        },
      })
    );
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'used up'
    );
  });

  it('requires a reason before pausing', () => {
    load();
    click('Pause Export worker');
    http.expectNone(`${base}/controls/export_worker`);
    expect(text()).toContain('Give a reason');
    expect(
      el.querySelector('#reason-export_worker')?.getAttribute('aria-invalid')
    ).toBe('true');
  });

  it('pauses with a reason and the current version', () => {
    load(undefined, controls({ export_worker: { version: 3 } }));
    type('reason-export_worker', '  maintenance ');
    click('Pause Export worker');
    const req = http.expectOne(`${base}/controls/export_worker`);
    expect(req.request.body).toEqual({
      paused: true,
      reason: 'maintenance',
      expectedVersion: 3,
    });
    req.flush(control('export_worker', { paused: true, version: 4 }));
    fixture.detectChanges();
    http.expectOne(`${base}/metrics`).flush(metrics());
    http.expectOne(`${base}/controls`).flush(
      controls({
        export_worker: { paused: true, version: 4, reason: 'maintenance' },
      })
    );
    fixture.detectChanges();
    expect(text()).toContain('Export worker paused.');
    expect(button('Resume Export worker')).toBeTruthy();
  });

  it('resumes a paused control', () => {
    load(
      undefined,
      controls({
        taxonomy_worker: { paused: true, version: 2, reason: 'why' },
      })
    );
    click('Resume Taxonomy worker');
    const req = http.expectOne(`${base}/controls/taxonomy_worker`);
    expect(req.request.body).toEqual({ paused: false, expectedVersion: 2 });
    req.flush(control('taxonomy_worker', { version: 3 }));
    http.expectOne(`${base}/metrics`).flush(metrics());
    http.expectOne(`${base}/controls`).flush(controls());
  });

  it('reloads and explains a stale version', () => {
    load();
    type('reason-export_worker', 'go');
    click('Pause Export worker');
    http
      .expectOne(`${base}/controls/export_worker`)
      .flush(
        { code: 'stale_version', message: 'Control changed' },
        { status: 409, statusText: 'Conflict' }
      );
    http.expectOne(`${base}/metrics`).flush(metrics());
    http.expectOne(`${base}/controls`).flush(
      controls({
        export_worker: { paused: true, version: 5, reason: 'other' },
      })
    );
    fixture.detectChanges();
    expect(text()).toContain('changed by someone else');
    expect(button('Resume Export worker')).toBeTruthy();
  });

  it('refresh reloads both', () => {
    load();
    click('Refresh operations');
    load(metrics({ towns: null }));
    expect(
      el.querySelector('section[aria-labelledby="m-towns"]')?.textContent
    ).toContain('Unavailable');
  });

  it('shows an alert when loading fails', () => {
    http
      .expectOne(`${base}/metrics`)
      .flush('x', { status: 503, statusText: 'Unavailable' });
    http
      .expectOne(`${base}/controls`)
      .flush('x', { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(el.querySelector('.page-error')?.getAttribute('role')).toBe('alert');
  });
});
