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
                <h2>
                  {{
                    feed.currentMode === 'live'
                      ? 'Live on air now'
                      : 'Scheduled programming'
                  }}
                </h2>
                <p>Timezone: {{ feed.timezone }}</p>
              </div>
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
              <article *ngFor="let block of schedule" class="schedule-card">
                <p class="eyebrow">
                  {{
                    block.blockType === 'live_window'
                      ? 'Live window'
                      : 'Prerecorded block'
                  }}
                </p>
                <h3>{{ block.title }}</h3>
                <p>
                  {{ block.startsAt | date: 'medium' }} to
                  {{ block.endsAt | date: 'medium' }}
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
        transition:
          transform var(--animation-duration-fast, 0.15s)
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

  constructor(
    private route: ActivatedRoute,
    private videoService: VideoService,
  ) {}

  ngOnInit() {
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
}
