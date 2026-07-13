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

    expect(videoService.issueLiveToken).toHaveBeenCalledWith('ot-live');
    expect(videoService.validateLiveToken).toHaveBeenCalledWith(
      'ot-live',
      'signed-token'
    );
    expect(fixture.nativeElement.textContent).toContain('Live now');
    expect(fixture.nativeElement.querySelector('video')?.src).toBe(
      'https://media.example/live.m3u8'
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
