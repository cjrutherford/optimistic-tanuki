import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ChannelFeedDto,
  LiveMediaTransportDto,
  LivePlaybackTokenDto,
} from '@optimistic-tanuki/ui-models';
import { VideoService } from '../../services/video.service';
import { LiveMediaTransportService } from '../../services/live-media-transport.service';

type PlaybackState =
  | 'loading'
  | 'standby'
  | 'connecting'
  | 'live'
  | 'ended'
  | 'offline'
  | 'error';

@Component({
  selector: 'video-live-playback',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="live-playback-page">
      <a class="back-link" [routerLink]="['/c', slugOrId]">Back to channel</a>
      <section class="live-card" aria-live="polite">
        <p class="eyebrow">Live handoff</p>
        <h1>{{ feed?.activeLiveSession?.title || 'Local live session' }}</h1>
        <ng-container [ngSwitch]="state">
          <p *ngSwitchCase="'loading'">Loading the channel handoff...</p>
          <p *ngSwitchCase="'standby'">
            The channel is ready for live programming.
          </p>
          <p *ngSwitchCase="'connecting'">Connecting to the live session...</p>
          <ng-container *ngSwitchCase="'live'">
            <p class="status-live">Live now</p>
            <video
              *ngIf="token?.playbackUrl"
              data-testid="hls-player"
              controls
              autoplay
              playsinline
              [src]="token?.playbackUrl"
            ></video>
            <p *ngIf="!token?.playbackUrl">
              The live session is connected. A media source will appear when the
              broadcaster provides one.
            </p>
            <small *ngIf="token?.expiresAt">
              Handoff expires {{ token?.expiresAt | date : 'mediumTime' }}.
            </small>
          </ng-container>
          <p *ngSwitchCase="'ended'">This live session has ended.</p>
          <p *ngSwitchCase="'offline'">This channel is currently off air.</p>
          <p *ngSwitchCase="'error'">The live handoff could not be loaded.</p>
        </ng-container>
        <video
          #rtcPlayer
          class="rtc-player"
          [class.hidden]="!mediaTransport"
          autoplay
          playsinline
        ></video>
      </section>
    </main>
  `,
  styles: [
    `
      .live-playback-page {
        min-height: 100vh;
        padding: 2rem;
        color: var(--foreground, #f5f5f5);
        background: radial-gradient(
            circle at top,
            rgba(37, 99, 235, 0.18),
            transparent 45%
          ),
          #0b1020;
      }
      .back-link {
        color: #8be9fd;
      }
      .live-card {
        max-width: 760px;
        margin: 5rem auto;
        padding: 2rem;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 1rem;
        background: rgba(255, 255, 255, 0.06);
      }
      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.12em;
        opacity: 0.65;
        font-size: 0.75rem;
      }
      .status-live {
        color: #63e6be;
        font-weight: 700;
      }
      video {
        width: 100%;
        margin-top: 1rem;
        border-radius: 0.75rem;
        background: #000;
      }
      .rtc-player.hidden {
        display: none;
      }
    `,
  ],
})
export class LivePlaybackComponent implements OnInit, OnDestroy {
  @ViewChild('rtcPlayer')
  private rtcPlayer?: ElementRef<HTMLVideoElement>;

  feed: ChannelFeedDto | null = null;
  token: LivePlaybackTokenDto | null = null;
  mediaTransport: LiveMediaTransportDto | null = null;
  slugOrId = '';
  state: PlaybackState = 'loading';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly videoService: VideoService,
    private readonly liveMediaTransport: LiveMediaTransportService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnDestroy(): void {
    void this.liveMediaTransport.disconnect();
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const slugOrId = params.get('slugOrId');
      if (slugOrId) {
        this.slugOrId = slugOrId;
        this.loadHandoff(slugOrId);
      }
    });
  }

  private loadHandoff(slugOrId: string): void {
    void this.liveMediaTransport.disconnect();
    this.state = 'loading';
    this.mediaTransport = null;
    this.videoService.getChannelFeed(slugOrId).subscribe({
      next: (feed) => {
        this.feed = feed;
        if (feed.liveHandoff?.status !== 'ready') {
          this.state =
            feed.liveHandoff?.status === 'standby'
              ? 'standby'
              : feed.liveHandoff?.status === 'ended'
              ? 'ended'
              : 'offline';
          return;
        }

        this.state = 'connecting';
        this.videoService.issueLiveToken(slugOrId).subscribe({
          next: (token) => {
            if (token.status !== 'ready' || !token.token) {
              this.state = 'ended';
              return;
            }

            this.videoService
              .validateLiveToken(slugOrId, token.token)
              .subscribe({
                next: (validation) => {
                  if (!validation.valid) {
                    this.state = 'ended';
                    return;
                  }
                  this.token = {
                    ...token,
                    playbackUrl: validation.playbackUrl ?? token.playbackUrl,
                    expiresAt: validation.expiresAt ?? token.expiresAt,
                  };
                  this.mediaTransport =
                    validation.mediaTransport ?? token.mediaTransport ?? null;
                  if (!this.mediaTransport) {
                    this.state = 'live';
                    return;
                  }
                  void this.connectLiveTransport(this.mediaTransport);
                },
                error: () => (this.state = 'error'),
              });
          },
          error: () => (this.state = 'error'),
        });
      },
      error: () => (this.state = 'error'),
    });
  }

  private async connectLiveTransport(
    mediaTransport: LiveMediaTransportDto
  ): Promise<void> {
    this.changeDetector.detectChanges();
    const videoElement = this.rtcPlayer?.nativeElement;
    if (!videoElement) {
      this.state = 'error';
      return;
    }

    try {
      await this.liveMediaTransport.connect(mediaTransport, videoElement);
      this.state = 'live';
    } catch {
      this.state = 'error';
    }
  }
}
