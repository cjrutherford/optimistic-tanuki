import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { VideoProcessingMonitorComponent } from './video-processing-monitor.component';
import {
  VideoProcessingOverview,
  VideoProcessingService,
} from '../services/video-processing.service';

const overview: VideoProcessingOverview = {
  totals: { pending: 1, processing: 2, ready: 4, failed: 1 },
  queue: { activeJobs: 0, queuedJobs: 0, maxConcurrentJobs: 2 },
  jobs: [
    {
      id: 'video-1',
      title: 'Sample video',
      processingStatus: 'failed',
      processingError: 'ffmpeg exited unexpectedly',
      updatedAt: '2026-07-20T12:00:00.000Z',
    },
  ],
};

describe('VideoProcessingMonitorComponent', () => {
  const processingService = {
    getOverview: jest.fn(() => of(overview)),
    retry: jest.fn(() => of(undefined)),
    retryFailed: jest.fn(() => of({ queued: 1 })),
  };

  beforeEach(async () => {
    processingService.getOverview.mockClear();
    processingService.retry.mockClear();
    processingService.retryFailed.mockClear();
    await TestBed.configureTestingModule({
      imports: [VideoProcessingMonitorComponent],
      providers: [
        { provide: VideoProcessingService, useValue: processingService },
      ],
    }).compileComponents();
  });

  it('renders status totals and recent processing jobs', () => {
    const fixture = TestBed.createComponent(VideoProcessingMonitorComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Processing queue');
    expect(text).toContain('Ready');
    expect(text).toContain('4');
    expect(text).toContain('Sample video');
    expect(text).toContain('ffmpeg exited unexpectedly');
    expect(text).toContain(
      'Attention: 2 processing job(s) have no active transcoder job.'
    );
  });

  it('reports active transcoding work from queue metrics', () => {
    processingService.getOverview.mockReturnValueOnce(
      of({
        ...overview,
        queue: { activeJobs: 2, queuedJobs: 3, maxConcurrentJobs: 2 },
      })
    );
    const fixture = TestBed.createComponent(VideoProcessingMonitorComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Transcoding 2 job(s) · 3 queued'
    );
  });

  it('disables retry controls while an action is in progress', () => {
    const fixture = TestBed.createComponent(VideoProcessingMonitorComponent);
    fixture.detectChanges();
    fixture.componentInstance.retryingId = 'video-1';
    fixture.detectChanges();

    const retryButton = fixture.nativeElement.querySelector(
      '[data-testid="retry-video-1"]'
    );
    expect(retryButton.disabled).toBe(true);
  });

  it('retries an individual failed job and refreshes the overview', () => {
    const fixture = TestBed.createComponent(VideoProcessingMonitorComponent);
    fixture.detectChanges();
    processingService.getOverview.mockClear();

    fixture.componentInstance.retry('video-1');

    expect(processingService.retry).toHaveBeenCalledWith('video-1');
    expect(processingService.getOverview).toHaveBeenCalled();
  });

  it('allows retrying a processing job so an operator can recover a stalled job', () => {
    processingService.getOverview.mockReturnValueOnce(
      of({
        ...overview,
        jobs: [
          {
            ...overview.jobs[0],
            processingStatus: 'processing',
            processingError: null,
          },
        ],
      })
    );
    const fixture = TestBed.createComponent(VideoProcessingMonitorComponent);
    fixture.detectChanges();

    const retryButton = fixture.nativeElement.querySelector(
      '[data-testid="retry-video-1"]'
    );
    expect(retryButton.disabled).toBe(false);
  });

  it('only retries all failed jobs after confirmation', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const fixture = TestBed.createComponent(VideoProcessingMonitorComponent);
    fixture.detectChanges();

    fixture.componentInstance.retryFailed();
    expect(processingService.retryFailed).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    fixture.componentInstance.retryFailed();
    expect(processingService.retryFailed).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('loads once but does not register polling during server-side rendering', async () => {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [VideoProcessingMonitorComponent],
        providers: [
          { provide: VideoProcessingService, useValue: processingService },
          { provide: PLATFORM_ID, useValue: 'server' },
        ],
      })
      .compileComponents();
    processingService.getOverview.mockClear();

    const fixture = TestBed.createComponent(VideoProcessingMonitorComponent);
    fixture.detectChanges();
    jest.useFakeTimers();
    jest.advanceTimersByTime(20_000);
    jest.useRealTimers();

    expect(processingService.getOverview).toHaveBeenCalledTimes(1);
  });
});
