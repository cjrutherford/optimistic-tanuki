import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BugReportService } from './bug-report.service';
import { LogBufferService } from './log-buffer.service';
import { ScreenshotService } from './screenshot.service';

describe('BugReportService', () => {
  let svc: BugReportService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        BugReportService,
        LogBufferService,
        {
          provide: ScreenshotService,
          useValue: { capture: async () => 'data:image/jpeg;base64,/9j/' },
        },
      ],
    });
    svc = TestBed.inject(BugReportService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('GETs nonce then POSTs report without auth header', async () => {
    const done = svc.report('login broken');
    const nonceReq = http.expectOne('/api/bug-reports/nonce');
    expect(nonceReq.request.method).toBe('GET');
    expect(nonceReq.request.headers.has('Authorization')).toBe(false);
    nonceReq.flush({
      nonce: 'a'.repeat(64),
      expiresAt: new Date().toISOString(),
    });

    // report() awaits screenshot capture before POST — yield microtasks.
    await new Promise((r) => setTimeout(r, 0));

    const postReq = http.expectOne('/api/bug-reports');
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.headers.has('Authorization')).toBe(false);
    expect(postReq.request.body.description).toBe('login broken');
    expect(postReq.request.body.screenshotDataUrl).toContain('data:image/jpeg');
    postReq.flush({ id: '1', emailSent: true, issueUrl: null });

    await expect(done).resolves.toEqual({
      id: '1',
      emailSent: true,
      issueUrl: null,
    });
  });

  it('rejects empty description', async () => {
    await expect(svc.report('   ')).rejects.toThrow(/description/i);
  });
});
