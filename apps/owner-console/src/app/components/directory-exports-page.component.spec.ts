import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import {
  DEFAULT_RELEASE_ID,
  DirectoryExportsPageComponent,
} from './directory-exports-page.component';

const url = 'http://localhost:3000/api/directory/exports';
const sha = 'c'.repeat(64);
const job = (over: Record<string, unknown> = {}) => ({
  id: 'e0000000-0000-4000-8000-000000000001',
  actorId: '11111111-1111-4111-8111-111111111111',
  releaseId: '2026-10-21.0',
  scope: {},
  format: 'jsonl',
  status: 'queued',
  attempts: 0,
  errorCode: null,
  rowCount: null,
  excludedRows: null,
  byteCount: null,
  sha256: null,
  schemaVersion: null,
  expiresAt: null,
  completedAt: null,
  withdrawnAt: null,
  createdAt: '2026-11-17T00:00:00.000Z',
  updatedAt: '2026-11-17T00:00:00.000Z',
  ...over,
});

describe('DirectoryExportsPageComponent', () => {
  let fixture: ComponentFixture<DirectoryExportsPageComponent>;
  let http: HttpTestingController;
  let component: DirectoryExportsPageComponent;

  beforeEach(async () => {
    jest.useFakeTimers();
    let n = 0;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        randomUUID: () =>
          `e0000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      },
    });
    await TestBed.configureTestingModule({
      imports: [
        DirectoryExportsPageComponent,
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: API_BASE_URL, useValue: 'http://localhost:3000/api' },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DirectoryExportsPageComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    jest.useRealTimers();
  });

  const list = (items: unknown[]) => {
    http.expectOne(`${url}?limit=50`).flush({ items, total: items.length });
    fixture.detectChanges();
  };
  const text = () => fixture.nativeElement.textContent as string;

  it('shows the empty state', () => {
    list([]);
    expect(text()).toContain('No exports yet');
    expect(component.releaseId).toBe(DEFAULT_RELEASE_ID);
  });

  it('keeps one idempotency id across a resubmit after a network error', () => {
    list([]);
    component.communityId = ' 33333333-3333-4333-8333-333333333333 ';
    component.submit();
    const first = http.expectOne(url);
    expect(first.request.body).toEqual({
      id: 'e0000000-0000-4000-8000-000000000001',
      releaseId: '2026-10-21.0',
      communityId: '33333333-3333-4333-8333-333333333333',
    });
    first.error(new ProgressEvent('error'));
    expect(component.submitting).toBe(false);
    component.submit();
    const retry = http.expectOne(url);
    expect(retry.request.body.id).toBe(first.request.body.id);
    retry.flush(job());
    http.expectOne(`${url}?limit=50`).flush({ items: [job()], total: 1 });
    // A completed submission gets a fresh id next time.
    component.submit();
    expect(http.expectOne(url).request.body.id).not.toBe(first.request.body.id);
  });

  it('refuses an invalid release id without calling the gateway', () => {
    list([]);
    component.releaseId = '../etc';
    component.submit();
    http.expectNone(url);
    expect(component.message).toContain('release id');
  });

  it('renders jobs with the sha truncated and the full value in the title', () => {
    list([
      job({
        status: 'complete',
        rowCount: 120,
        excludedRows: 4,
        byteCount: 2048,
        sha256: sha,
        expiresAt: '2026-11-18T00:00:00.000Z',
      }),
    ]);
    expect(text()).toContain('120');
    expect(text()).toContain('2.0 KB');
    const code = fixture.nativeElement.querySelector('code.sha');
    expect(code.textContent).toContain('cccccccccccc…');
    expect(code.getAttribute('title')).toBe(sha);
    expect(
      fixture.nativeElement.querySelector('[aria-label^="Download"]')
    ).toBeTruthy();
  });

  it('offers download only for a complete job and retry only for a failed one', () => {
    list([
      job({ status: 'queued' }),
      job({
        id: 'e0000000-0000-4000-8000-000000000002',
        status: 'failed',
        errorCode: 'x',
      }),
    ]);
    expect(
      fixture.nativeElement.querySelector('[aria-label^="Download"]')
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelectorAll('[aria-label^="Retry"]')
    ).toHaveLength(1);
  });

  it('downloads the artifact as a blob and shows the sha', () => {
    const create = jest.fn(() => 'blob:x');
    const revoke = jest.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const complete = job({ status: 'complete', sha256: sha });
    list([complete]);
    component.download(complete as never);
    const req = http.expectOne(`${url}/${complete.id}/artifact`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['{}\n']), {
      headers: {
        'x-content-sha256': sha,
        'content-disposition': 'attachment; filename="export-1.jsonl"',
      },
    });
    expect(create).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith('blob:x');
    expect(component.message).toContain(sha);
    click.mockRestore();
  });

  it('explains a download that is gone', () => {
    const complete = job({ status: 'complete', sha256: sha });
    list([complete]);
    component.download(complete as never);
    http
      .expectOne(`${url}/${complete.id}/artifact`)
      .flush(new Blob(['gone']), { status: 410, statusText: 'Gone' });
    expect(component.message).toContain('expired or was withdrawn');
    http.expectOne(`${url}?limit=50`).flush({ items: [], total: 0 });
  });

  it('retries a failed job', () => {
    const failed = job({ status: 'failed', errorCode: 'io_error' });
    list([failed]);
    component.retry(failed as never);
    const req = http.expectOne(`${url}/${failed.id}/retry`);
    expect(req.request.method).toBe('POST');
    req.flush(job());
    http.expectOne(`${url}?limit=50`).flush({ items: [job()], total: 1 });
  });

  it('shows human error text for known codes and a generic one otherwise', () => {
    list([
      job({ status: 'failed', errorCode: 'export_not_granted' }),
      job({
        id: 'e0000000-0000-4000-8000-000000000002',
        status: 'failed',
        errorCode: 'no_eligible_rows',
      }),
      job({
        id: 'e0000000-0000-4000-8000-000000000003',
        status: 'failed',
        errorCode: 'io_error',
      }),
    ]);
    const alerts = Array.from(
      fixture.nativeElement.querySelectorAll('.export-error[role="alert"]')
    ).map((e) => (e as HTMLElement).textContent);
    expect(alerts[0]).toContain('No export grant for this release');
    expect(alerts[0]).toContain(
      'Public display approval does not allow export.'
    );
    expect(alerts[1]).toContain('No rows were eligible to export.');
    expect(alerts[2]).toContain('io_error');
  });

  it('polls while a job is in flight and stops when it is done', () => {
    list([job({ status: 'running' })]);
    jest.advanceTimersByTime(3000);
    http
      .expectOne(`${url}?limit=50`)
      .flush({ items: [job({ status: 'complete', sha256: sha })], total: 1 });
    jest.advanceTimersByTime(9000);
    http.expectNone(`${url}?limit=50`);
  });
});
