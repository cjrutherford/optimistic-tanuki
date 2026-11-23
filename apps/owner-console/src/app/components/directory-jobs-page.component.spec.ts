import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { OwnerConfirmService } from '@optimistic-tanuki/owner-page-ui';
import {
  DirectoryJobsPageComponent,
  JOB_POLL_MAX_MS,
  JOB_POLL_START_MS,
  RENORMALIZE_CONFIRMATION,
} from './directory-jobs-page.component';
import {
  OwnerConfirmStub,
  createOwnerConfirmStub,
} from './owner-confirm.testing';

const startUrl = '/api/directory/jobs/renormalize';
const id = '22222222-2222-4222-8222-222222222222';
const jobUrl = `/api/directory/jobs/${id}`;
const job = (over: Record<string, unknown> = {}) => ({
  id,
  kind: 'renormalize',
  status: 'running',
  dryRun: true,
  townId: null,
  startedAt: '2026-11-20T00:00:00.000Z',
  finishedAt: null,
  counts: { scansTotal: 4, scansDone: 1, scanned: 10, updated: 2, skipped: 1 },
  error: null,
  ...over,
});

describe('DirectoryJobsPageComponent', () => {
  let fixture: ComponentFixture<DirectoryJobsPageComponent>;
  let component: DirectoryJobsPageComponent;
  let http: HttpTestingController;
  let confirmStub: OwnerConfirmStub;

  beforeEach(async () => {
    jest.useFakeTimers();
    confirmStub = createOwnerConfirmStub();
    await TestBed.configureTestingModule({
      imports: [DirectoryJobsPageComponent, HttpClientTestingModule],
      providers: [
        { provide: API_BASE_URL, useValue: '/api' },
        { provide: OwnerConfirmService, useValue: confirmStub },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DirectoryJobsPageComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    jest.useRealTimers();
  });

  it('starts a dry run by default without asking for a confirmation', async () => {
    await component.start();
    expect(confirmStub.confirm).not.toHaveBeenCalled();
    const req = http.expectOne(startUrl);
    expect(req.request.body).toEqual({ dryRun: true });
    req.flush(job({ status: 'succeeded' }));
  });

  it('refuses a real run without a reason', async () => {
    component.dryRun = false;
    await component.start();
    http.expectNone(startUrl);
    expect(component.actionError()).toContain('reason');
  });

  it('asks for the typed phrase before a real run', async () => {
    component.dryRun = false;
    component.reason = 'new rules';
    await component.start();
    expect(confirmStub.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'typed',
        typedPhrase: RENORMALIZE_CONFIRMATION,
      })
    );
    const req = http.expectOne(startUrl);
    expect(req.request.body).toEqual({ dryRun: false, reason: 'new rules' });
    req.flush(job({ dryRun: false, status: 'succeeded' }));
  });

  it('does not start a real run when the confirmation is cancelled', async () => {
    confirmStub.confirm.mockResolvedValue({ confirmed: false });
    component.dryRun = false;
    component.reason = 'new rules';
    await component.start();
    http.expectNone(startUrl);
  });

  it('rejects a malformed town id', async () => {
    component.townId = 'nope';
    await component.start();
    http.expectNone(startUrl);
    expect(component.actionError()).toContain('town id');
  });

  it('polls with a growing delay and stops once the job is done', async () => {
    await component.start();
    http.expectOne(startUrl).flush(job());
    // First poll after the start delay.
    jest.advanceTimersByTime(JOB_POLL_START_MS - 1);
    http.expectNone(jobUrl);
    jest.advanceTimersByTime(1);
    http.expectOne(jobUrl).flush(job());
    // Backoff: not due after the start delay again.
    jest.advanceTimersByTime(JOB_POLL_START_MS);
    http.expectNone(jobUrl);
    jest.advanceTimersByTime(JOB_POLL_MAX_MS);
    http.expectOne(jobUrl).flush(job({ status: 'succeeded' }));
    expect(component.job()?.status).toBe('succeeded');
    expect(component.polling()).toBe(false);
    jest.advanceTimersByTime(JOB_POLL_MAX_MS * 3);
    http.expectNone(jobUrl);
  });

  it('stops polling after repeated failures and offers Retry', async () => {
    await component.start();
    http.expectOne(startUrl).flush(job());
    for (let i = 0; i < 3; i++) {
      jest.advanceTimersByTime(JOB_POLL_MAX_MS);
      http
        .expectOne(jobUrl)
        .flush('', { status: 503, statusText: 'Unavailable' });
    }
    expect(component.pollError()).toContain('unavailable');
    jest.advanceTimersByTime(JOB_POLL_MAX_MS * 3);
    http.expectNone(jobUrl);
    component.retryPolling();
    jest.advanceTimersByTime(JOB_POLL_START_MS);
    http.expectOne(jobUrl).flush(job({ status: 'failed', error: 'x' }));
    expect(component.polling()).toBe(false);
  });

  it('stops polling when the job is no longer known', async () => {
    await component.start();
    http.expectOne(startUrl).flush(job());
    jest.advanceTimersByTime(JOB_POLL_START_MS);
    http.expectOne(jobUrl).flush('', { status: 404, statusText: 'Not Found' });
    expect(component.pollError()).toContain('no longer known');
    jest.advanceTimersByTime(JOB_POLL_MAX_MS * 3);
    http.expectNone(jobUrl);
  });

  it('stops polling when the page is destroyed', async () => {
    await component.start();
    http.expectOne(startUrl).flush(job());
    fixture.destroy();
    jest.advanceTimersByTime(JOB_POLL_MAX_MS * 3);
    http.expectNone(jobUrl);
  });

  it('explains a job already running', async () => {
    await component.start();
    http
      .expectOne(startUrl)
      .flush(
        { code: 'invalid_state', detail: 'job_running' },
        { status: 409, statusText: 'Conflict' }
      );
    expect(component.actionError()).toContain('already running');
  });
});
