import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { VideoProcessingService } from './video-processing.service';

describe('VideoProcessingService', () => {
  let service: VideoProcessingService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(VideoProcessingService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the processing overview', () => {
    service.getOverview().subscribe((overview) => {
      expect(overview.totals.ready).toBe(4);
    });

    const request = http.expectOne('/api/videos/processing/overview');
    expect(request.request.method).toBe('GET');
    request.flush({
      totals: { pending: 1, processing: 2, ready: 4, failed: 3 },
      jobs: [],
    });
  });

  it('requests an individual retry', () => {
    service.retry('video-1').subscribe();

    const request = http.expectOne('/api/videos/video-1/retry-processing');
    expect(request.request.method).toBe('POST');
    request.flush({});
  });

  it('requests retries for all failed jobs', () => {
    service.retryFailed().subscribe((result) => expect(result.queued).toBe(3));

    const request = http.expectOne('/api/videos/processing/retry-failed');
    expect(request.request.method).toBe('POST');
    request.flush({ queued: 3 });
  });
});
