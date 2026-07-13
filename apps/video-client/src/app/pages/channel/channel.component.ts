import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { VideoService } from '../../services/video.service';
import {
  VideoDto,
  ChannelDto,
  ChannelFeedDto,
  ProgramBlockDto,
} from '@optimistic-tanuki/ui-models';
import {
  ChannelHeaderComponent,
  VideoGridComponent,
} from '@optimistic-tanuki/video-ui';
import { ParticleVeilComponent } from '@optimistic-tanuki/motion-ui';
import {
  OnPageCampaign,
  SponsorDiscoveryService,
} from '../../services/sponsor-discovery.service';

@Component({
  selector: 'video-channel',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ChannelHeaderComponent,
    VideoGridComponent,
    ParticleVeilComponent,
  ],
  template: `
    <div class="channel-page">
      <div class="ambient-bg">
        <otui-particle-veil
          height="200px"
          [density]="12"
          [speed]="0.6"
          [intensity]="0.4"
        ></otui-particle-veil>
      </div>

      <div class="channel-content-wrapper">
        <div *ngIf="channel">
          <channel-header
            [channel]="channel"
            [isSubscribed]="isSubscribed"
            (subscribe)="onSubscribe($event)"
            (unsubscribe)="onUnsubscribe($event)"
          ></channel-header>

          <div class="channel-content">
            <nav class="channel-nav">
              <button
                class="nav-tab"
                [class.active]="activeTab === 'feed'"
                (click)="activeTab = 'feed'"
              >
                Feed
              </button>
              <button
                class="nav-tab"
                [class.active]="activeTab === 'videos'"
                (click)="activeTab = 'videos'"
              >
                Videos
              </button>
              <button
                class="nav-tab"
                [class.active]="activeTab === 'schedule'"
                (click)="activeTab = 'schedule'"
              >
                Schedule
              </button>
              <button
                class="nav-tab"
                [class.active]="activeTab === 'about'"
                (click)="activeTab = 'about'"
              >
                About
              </button>
            </nav>

            <section *ngIf="activeTab === 'feed'" class="feed-section">
              <div *ngIf="feed" class="feed-status-card">
                <p class="eyebrow">Current Feed</p>
                <h2>{{ getFeedHeadline() }}</h2>
                <p *ngIf="getFeedDetail() as detail">{{ detail }}</p>
                <p *ngIf="feed?.activePlaylistItem as playlistItem">
                  {{ getPlaylistLabel(playlistItem.kind) }}
                </p>
                <a
                  *ngIf="getPlaylistVideoId() as videoId"
                  class="live-link"
                  data-testid="current-playlist-link"
                  [routerLink]="['/watch', videoId]"
                >
                  Watch current program
                </a>
                <p>Timezone: {{ feed.timezone }}</p>
              </div>

              <div
                *ngIf="feed?.activeLiveSession && feed?.liveHandoff"
                class="feed-status-card live-handoff-card"
              >
                <p class="eyebrow">Live handoff ready</p>
                <h3>{{ feed?.activeLiveSession?.title }}</h3>
                <p>
                  Status: {{ feed?.liveHandoff?.status }} · Token contract:
                  {{ feed?.liveHandoff?.tokenContract }}
                </p>
                <p>Locality policy: {{ feed?.liveHandoff?.localityPolicy }}</p>
                <a
                  *ngIf="feed?.liveHandoff?.playbackPath"
                  class="live-link"
                  [routerLink]="feed?.liveHandoff?.playbackPath"
                >
                  Open live playback contract
                </a>
              </div>

              <section *ngIf="channelSponsors.length" class="sponsor-rail">
                <p class="eyebrow">Local supporters</p>
                <article
                  *ngFor="let sponsor of channelSponsors"
                  class="sponsor-card"
                >
                  <strong>{{
                    sponsor.creative.headline || sponsor.name
                  }}</strong>
                  <p>{{ sponsor.creative.body }}</p>
                  <a
                    *ngIf="sponsor.creative.ctaUrl"
                    [href]="sponsor.creative.ctaUrl"
                    target="_blank"
                    rel="noopener"
                  >
                    {{ sponsor.creative.ctaLabel || 'Visit sponsor' }}
                  </a>
                </article>
              </section>
            </section>

            <div *ngIf="activeTab === 'videos'" class="videos-section">
              <video-grid
                [videos]="channelVideos"
                (videoClick)="navigateToVideo($event)"
              ></video-grid>

              <div
                *ngIf="channelVideos.length === 0 && !loading"
                class="no-videos"
              >
                <p>This channel hasn't uploaded any videos yet.</p>
              </div>
            </div>

            <section *ngIf="activeTab === 'schedule'" class="schedule-section">
              <div *ngIf="schedule.length === 0" class="no-videos">
                <p>No blocks are scheduled right now.</p>
              </div>
              <article
                *ngFor="let block of schedule"
                class="schedule-card"
                [class.highlighted]="block.id === highlightedScheduleBlockId"
              >
                <p class="eyebrow">
                  {{
                    block.blockType === 'live_window'
                      ? 'Live window'
                      : 'Prerecorded block'
                  }}
                </p>
                <h3>{{ block.title }}</h3>
                <p>
                  {{ block.startsAt | date : 'medium' }} to
                  {{ block.endsAt | date : 'medium' }}
                </p>
                <p>Status: {{ block.status }}</p>
              </article>
            </section>

            <section *ngIf="activeTab === 'about'" class="about-section">
              <p>{{ channel.description || 'No channel description yet.' }}</p>
              <p *ngIf="channel.communitySlug">
                Community: {{ channel.communitySlug }}
              </p>
              <p *ngIf="channel.joinPolicy">
                Join policy: {{ channel.joinPolicy }}
              </p>
              <p
                *ngIf="
                  channel.anchorLat !== undefined &&
                  channel.anchorLng !== undefined
                "
              >
                Locality anchor: {{ channel.anchorLat }},
                {{ channel.anchorLng }}
              </p>
              <p *ngIf="channel.timezone">
                Channel timezone: {{ channel.timezone }}
              </p>
            </section>
          </div>
        </div>

        <div *ngIf="loading" class="loading">
          <p>Loading channel...</p>
        </div>

        <div *ngIf="error" class="error">
          <p>{{ error }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .channel-page {
        position: relative;
        max-width: 1400px;
        margin: 0 auto;
      }

      .ambient-bg {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 200px;
        z-index: 0;
        pointer-events: none;
        opacity: 0.25;
        overflow: hidden;
      }

      .channel-content-wrapper {
        position: relative;
        z-index: 1;
      }

      .channel-content {
        padding: 0 1.5rem 2rem;
      }

      .channel-nav {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 2rem;
        padding: 0.25rem;
        background: rgba(var(--background-rgb, 10, 10, 15), 0.5);
        backdrop-filter: blur(12px);
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        width: fit-content;
      }

      .nav-tab {
        padding: 0.625rem 1.25rem;
        border: none;
        background: transparent;
        font-size: 0.875rem;
        font-weight: 500;
        color: rgba(var(--foreground-rgb, 232, 232, 236), 0.6);
        cursor: pointer;
        border-radius: 999px;
        transition: all var(--animation-duration-fast, 0.15s)
          var(--animation-easing, ease);
      }

      .nav-tab:hover {
        color: var(--foreground);
        background: rgba(var(--foreground-rgb, 232, 232, 236), 0.08);
      }

      .nav-tab.active {
        color: var(--foreground);
        background: rgba(var(--accent-rgb, 99, 102, 241), 0.2);
        box-shadow: 0 0 16px rgba(var(--accent-rgb, 99, 102, 241), 0.25);
      }

      .feed-status-card {
        backdrop-filter: blur(16px);
        background: rgba(var(--background-rgb, 10, 10, 15), 0.7);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-left: 3px solid var(--accent, #6366f1);
        border-radius: var(--personality-border-radius, 12px);
        padding: 1.5rem;
        color: var(--foreground);
      }

      .feed-status-card h2 {
        font-family: var(--font-heading, system-ui);
        font-weight: 700;
        margin: 0.5rem 0;
      }

      .live-handoff-card {
        margin-top: 1rem;
      }

      .live-link {
        display: inline-flex;
        margin-top: 0.75rem;
        color: var(--accent, #6366f1);
        text-decoration: none;
        font-weight: 600;
      }

      .eyebrow {
        text-transform: uppercase;
        font-size: 0.7rem;
        letter-spacing: 0.1em;
        color: var(--accent, #6366f1);
        font-weight: 600;
      }

      .schedule-card {
        backdrop-filter: blur(16px);
        background: rgba(var(--background-rgb, 10, 10, 15), 0.6);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: var(--personality-border-radius, 12px);
        padding: 1.5rem;
        margin-bottom: 1rem;
        color: var(--foreground);
        transition: transform var(--animation-duration-fast, 0.15s)
            var(--animation-easing, ease),
          box-shadow var(--animation-duration-fast, 0.15s)
            var(--animation-easing, ease);
      }

      .schedule-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      }

      .schedule-card h3 {
        font-family: var(--font-heading, system-ui);
        font-weight: 700;
        margin: 0.5rem 0;
      }

      .schedule-card.highlighted {
        border-color: rgba(var(--accent-rgb, 99, 102, 241), 0.45);
        box-shadow: 0 0 0 1px rgba(var(--accent-rgb, 99, 102, 241), 0.3),
          0 18px 36px rgba(var(--accent-rgb, 99, 102, 241), 0.12);
      }

      .videos-section {
        min-height: 400px;
      }

      .no-videos {
        text-align: center;
        padding: 4rem 2rem;
        color: rgba(var(--foreground-rgb, 232, 232, 236), 0.5);
      }

      .about-section {
        color: rgba(var(--foreground-rgb, 232, 232, 236), 0.8);
        line-height: 1.7;
      }

      .about-section p {
        margin-bottom: 0.75rem;
      }

      .loading,
      .error {
        text-align: center;
        padding: 3rem;
        font-size: 1.125rem;
        color: rgba(var(--foreground-rgb, 232, 232, 236), 0.6);
      }

      .sponsor-rail {
        margin-top: 1rem;
        display: grid;
        gap: 0.65rem;
      }
      .sponsor-card {
        padding: 0.9rem;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 0.8rem;
        background: rgba(255, 255, 255, 0.04);
      }
      .sponsor-card p {
        margin: 0.35rem 0;
        opacity: 0.8;
      }
      .sponsor-card a {
        color: var(--primary, #5eead4);
      }

      .error {
        color: var(--danger, #ef4444);
      }
    `,
  ],
})
export class ChannelComponent implements OnInit {
  channel: ChannelDto | null = null;
  channelVideos: VideoDto[] = [];
  channelSlugOrId: string | null = null;
  feed: ChannelFeedDto | null = null;
  schedule: ProgramBlockDto[] = [];
  loading = false;
  error: string | null = null;
  isSubscribed = false;
  activeTab: 'feed' | 'videos' | 'schedule' | 'about' = 'feed';
  highlightedScheduleBlockId: string | null = null;
  channelSponsors: OnPageCampaign[] = [];

  constructor(
    private route: ActivatedRoute,
    private videoService: VideoService,
    private sponsorDiscoveryService: SponsorDiscoveryService
  ) {}

  ngOnInit() {
    this.route.queryParamMap.subscribe((params) => {
      const tab = params.get('tab');
      if (
        tab === 'feed' ||
        tab === 'videos' ||
        tab === 'schedule' ||
        tab === 'about'
      ) {
        this.activeTab = tab;
      }

      this.highlightedScheduleBlockId = params.get('block');
    });

    this.route.paramMap.subscribe((params) => {
      this.channelSlugOrId = params.get('slugOrId');
      if (this.channelSlugOrId) {
        this.loadChannel(this.channelSlugOrId);
        this.loadChannelFeed(this.channelSlugOrId);
        this.loadChannelSchedule(this.channelSlugOrId);
      }
    });
  }

  loadChannel(id: string) {
    this.loading = true;
    this.error = null;

    this.videoService.getChannel(id).subscribe({
      next: (channel) => {
        this.channel = channel;
        this.loading = false;
        this.loadChannelVideos(channel.id);
        this.loadChannelSponsors(channel);
      },
      error: (err) => {
        this.error = 'Failed to load channel';
        this.loading = false;
        console.error('Error loading channel:', err);
      },
    });
  }

  async loadChannelVideos(channelId: string) {
    this.channelVideos = await this.videoService
      .getChannelVideos(channelId)
      .catch((err: any) => {
        console.error('Error loading channel videos:', err);
        return [];
      });
  }

  loadChannelFeed(slugOrId: string) {
    this.videoService.getChannelFeed(slugOrId).subscribe({
      next: (feed) => {
        this.feed = feed;
      },
      error: (err) => {
        console.error('Error loading channel feed:', err);
      },
    });
  }

  loadChannelSchedule(slugOrId: string) {
    this.videoService.getChannelSchedule(slugOrId).subscribe({
      next: (schedule) => {
        this.schedule = schedule;
      },
      error: (err) => {
        console.error('Error loading channel schedule:', err);
      },
    });
  }

  loadChannelSponsors(channel: ChannelDto) {
    this.sponsorDiscoveryService
      .discoverOnPage({ channelId: channel.id })
      .subscribe({
        next: (sponsors) => (this.channelSponsors = sponsors),
        error: () => (this.channelSponsors = []),
      });
  }

  navigateToVideo(video: VideoDto) {
    window.location.href = `/watch/${video.id}`;
  }

  onSubscribe(channelId: string) {
    console.log('Subscribe to channel:', channelId);
    this.isSubscribed = true;
  }

  onUnsubscribe(channelId: string) {
    console.log('Unsubscribe from channel:', channelId);
    this.isSubscribed = false;
  }

  getFeedHeadline(): string {
    switch (this.feed?.currentMode) {
      case 'live':
        return 'Live on air now';
      case 'replay':
        return 'Replay continuity';
      case 'scheduled':
        return 'Scheduled programming';
      default:
        return 'Currently off air';
    }
  }

  getFeedDetail(): string | null {
    const activeBlock = this.schedule.find(
      (block) => block.id === this.feed?.activeProgramBlockId
    );

    if (!activeBlock) {
      return null;
    }

    switch (this.feed?.currentMode) {
      case 'replay':
        return `Now looping: ${activeBlock.title}`;
      case 'scheduled':
        return `Airing now: ${activeBlock.title}`;
      default:
        return activeBlock.title;
    }
  }

  getPlaylistVideoId(): string | null {
    return this.feed?.activePlaylistItem?.videoId ?? null;
  }

  getPlaylistLabel(
    kind: NonNullable<ChannelFeedDto['activePlaylistItem']>['kind']
  ): string {
    const labels: Record<string, string> = {
      live: 'Live session',
      scheduled: 'Scheduled program',
      rerun: 'Replay program',
      ad: 'Local ad break',
      filler: 'Local filler program',
      offline: 'No current programming',
    };
    return labels[kind] ?? 'Current program';
  }
}
