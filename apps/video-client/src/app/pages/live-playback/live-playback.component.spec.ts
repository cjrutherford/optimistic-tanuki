import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { LivePlaybackComponent } from './live-playback.component';
import { VideoService } from '../../services/video.service';
import { LiveMediaTransportService } from '../../services/live-media-transport.service';

describe('LivePlaybackComponent', () => {
  let fixture: ComponentFixture<LivePlaybackComponent>;
  let videoService: jest.Mocked<VideoService>;
  let liveMediaTransport: jest.Mocked<LiveMediaTransportService>;

  beforeEach(async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) =>
          success({
            coords: { latitude: 32.0809, longitude: -81.0912 },
          } as GeolocationPosition),
      },
    });

    const videoServiceSpy = {
      getChannelFeed: jest.fn(),
      issueLiveToken: jest.fn(),
      validateLiveToken: jest.fn(),
    };
    const liveMediaTransportSpy = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [LivePlaybackComponent],
      providers: [
        { provide: VideoService, useValue: videoServiceSpy },
        { provide: LiveMediaTransportService, useValue: liveMediaTransportSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ slugOrId: 'ot-live' })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LivePlaybackComponent);
    videoService = TestBed.inject(VideoService) as jest.Mocked<VideoService>;
    liveMediaTransport = TestBed.inject(
      LiveMediaTransportService
    ) as jest.Mocked<LiveMediaTransportService>;
  });

  it('moves from connecting to live after a ready handoff token', async () => {
    videoService.getChannelFeed.mockReturnValue(
      of({
        currentMode: 'live',
        activeLiveSession: { title: 'Savannah Signal Live' },
        liveHandoff: { status: 'ready' },
      } as any)
    );
    videoService.issueLiveToken.mockReturnValue(
      of({
        status: 'ready',
        token: 'signed-token',
        sessionId: 'session-1',
        playbackUrl: 'https://media.example/live.m3u8',
        expiresAt: new Date('2026-07-12T16:00:00.000Z'),
      })
    );
    videoService.validateLiveToken.mockReturnValue(
      of({
        valid: true,
        sessionId: 'session-1',
        playbackUrl: 'https://media.example/live.m3u8',
        expiresAt: new Date('2026-07-12T16:00:00.000Z'),
      })
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(videoService.issueLiveToken).toHaveBeenCalledWith('ot-live', {
      viewerLat: 32.0809,
      viewerLng: -81.0912,
      viewerSessionId: expect.any(String),
      viewerAccuracyMeters: undefined,
      observedAt: expect.any(String),
    });
    const issueLocation = videoService.issueLiveToken.mock.calls[0][1];
    expect(videoService.validateLiveToken).toHaveBeenCalledWith(
      'ot-live',
      'signed-token',
      issueLocation
    );
    expect(fixture.nativeElement.textContent).toContain('Live now');
    expect(fixture.nativeElement.querySelector('video')?.src).toBe(
      'https://media.example/live.m3u8'
    );
  });

  it('shows suspicious locality information without blocking live playback', async () => {
    videoService.getChannelFeed.mockReturnValue(
      of({ currentMode: 'live', liveHandoff: { status: 'ready' } } as any)
    );
    videoService.issueLiveToken.mockReturnValue(
      of({
        status: 'ready',
        token: 'signed-token',
        sessionId: 'session-1',
        playbackUrl: null,
        expiresAt: null,
        localityTrust: {
          status: 'suspicious',
          confidenceScore: 20,
          reasons: ['rapid-displacement'],
          observedAt: '2026-07-18T18:00:00.000Z',
          action: 'observe',
        },
      } as any)
    );
    videoService.validateLiveToken.mockReturnValue(
      of({
        valid: true,
        sessionId: 'session-1',
        playbackUrl: 'https://media.example/live.m3u8',
        localityTrust: {
          status: 'suspicious',
          confidenceScore: 20,
          reasons: ['rapid-displacement'],
          observedAt: '2026-07-18T18:00:00.000Z',
          action: 'observe',
        },
      } as any)
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Live now');
    expect(fixture.nativeElement.textContent).toContain(
      'Locality signals need review'
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'This live session has ended.'
    );
  });

  it('shows standby without requesting a token while programming is scheduled', async () => {
    videoService.getChannelFeed.mockReturnValue(
      of({
        currentMode: 'scheduled',
        liveHandoff: { status: 'standby' },
      } as any)
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(videoService.issueLiveToken).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'ready for live programming'
    );
  });

  it('shows ended when token issuance reports the live session is no longer available', async () => {
    videoService.getChannelFeed.mockReturnValue(
      of({
        currentMode: 'live',
        liveHandoff: { status: 'ready' },
      } as any)
    );
    videoService.issueLiveToken.mockReturnValue(
      of({
        status: 'unavailable',
        token: null,
        sessionId: null,
        playbackUrl: null,
        expiresAt: null,
      })
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'This live session has ended.'
    );
  });

  it('shows ended when signed-token validation rejects a stopped session', async () => {
    videoService.getChannelFeed.mockReturnValue(
      of({
        currentMode: 'live',
        liveHandoff: { status: 'ready' },
      } as any)
    );
    videoService.issueLiveToken.mockReturnValue(
      of({
        status: 'ready',
        token: 'signed-token',
        sessionId: 'session-1',
        playbackUrl: null,
        expiresAt: new Date('2026-07-12T16:00:00.000Z'),
      })
    );
    videoService.validateLiveToken.mockReturnValue(of({ valid: false }));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'This live session has ended.'
    );
  });

  it('shows an actionable message and does not request a token when location is denied', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (
          _success: PositionCallback,
          error: PositionErrorCallback
        ) =>
          error({
            code: 1,
            message: 'Permission denied',
          } as GeolocationPositionError),
      },
    });
    videoService.getChannelFeed.mockReturnValue(
      of({ currentMode: 'live', liveHandoff: { status: 'ready' } } as any)
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(videoService.issueLiveToken).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'Allow location access in your browser to watch this local live session.'
    );
  });

  it('shows an actionable message and does not request a token when location is unavailable', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    });
    videoService.getChannelFeed.mockReturnValue(
      of({ currentMode: 'live', liveHandoff: { status: 'ready' } } as any)
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(videoService.issueLiveToken).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'This browser cannot provide location access, so the local live session cannot be loaded.'
    );
  });

  it('connects to validated LiveKit transport before marking the session live', async () => {
    const mediaTransport = {
      type: 'livekit' as const,
      serverUrl: 'wss://live.example.test',
      roomName: 'metrocast-community-1-session-1',
      token: 'livekit-token',
      expiresAt: new Date('2026-07-12T16:00:00.000Z'),
    };
    videoService.getChannelFeed.mockReturnValue(
      of({ currentMode: 'live', liveHandoff: { status: 'ready' } } as any)
    );
    videoService.issueLiveToken.mockReturnValue(
      of({
        status: 'ready',
        token: 'signed-token',
        sessionId: 'session-1',
        playbackUrl: 'https://media.example/live.m3u8',
        expiresAt: new Date('2026-07-12T16:00:00.000Z'),
      })
    );
    videoService.validateLiveToken.mockReturnValue(
      of({ valid: true, sessionId: 'session-1', mediaTransport })
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(liveMediaTransport.connect).toHaveBeenCalledWith(
      mediaTransport,
      expect.any(HTMLVideoElement)
    );
    expect(fixture.nativeElement.textContent).toContain('Live now');
  });
});
