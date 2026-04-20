import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { VideoService } from '../../services/video.service';
import { VideoDto } from '@optimistic-tanuki/ui-models';
import {
  VideoPlayerComponent,
  ChannelHeaderComponent,
} from '@optimistic-tanuki/video-ui';
import { GlassFogComponent } from '@optimistic-tanuki/motion-ui';

@Component({
  selector: 'video-watch',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    VideoPlayerComponent,
    ChannelHeaderComponent,
    GlassFogComponent,
  ],
  template: `
    <div class="watch-page">
      <div class="ambient-bg">
        <otui-glass-fog></otui-glass-fog>
      </div>

      <div class="watch-content">
        <div class="video-container" *ngIf="video">
          <video-player
            [videoUrl]="getVideoUrl(video.playbackAssetId || video.assetId)"
            [hlsUrl]="getHlsUrl(video.hlsManifestAssetId)"
            [title]="video.title"
            [description]="video.description"
            (play)="onVideoPlay()"
            (ended)="onVideoEnded()"
          ></video-player>

          <div class="video-metadata">
            <div class="video-stats">
              <span>{{ video.viewCount | number }} views</span>
              <span class="separator">•</span>
              <span>{{ video.createdAt | date }}</span>
            </div>

            <div class="video-actions">
              <button
                class="action-button"
                [class.active]="isLiked"
                (click)="toggleLike()"
              >
                <span class="icon">👍</span>
                <span>{{ video.likeCount | number }}</span>
              </button>
              <button class="action-button" (click)="shareVideo()">
                <span class="icon">🔗</span>
                <span>Share</span>
              </button>
            </div>
          </div>
        </div>

        <div class="channel-section" *ngIf="video?.channel">
          <channel-header
            [channel]="video!.channel!"
            [isSubscribed]="isSubscribed"
            (subscribe)="onSubscribe($event)"
            (unsubscribe)="onUnsubscribe($event)"
          ></channel-header>
        </div>

        <div class="related-videos">
          <h3>Related Videos</h3>
          <!-- Related videos would go here -->
        </div>

        <div *ngIf="loading" class="loading">
          <p>Loading video...</p>
        </div>

        <div *ngIf="error" class="error">
          <p>{{ error }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .watch-page {
        position: relative;
        max-width: 1400px;
        margin: 0 auto;
        padding: 1.5rem;
      }

      .ambient-bg {
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        opacity: 0.1;
        overflow: hidden;
      }

      .watch-content {
        position: relative;
        z-index: 1;
      }

      .video-container {
        margin-bottom: 2rem;
      }

      .video-metadata {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.5rem;
        margin-bottom: 1rem;
        backdrop-filter: blur(16px);
        background: rgba(var(--background-rgb, 10, 10, 15), 0.7);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: var(--personality-border-radius, 12px);
      }

      .video-stats {
        display: flex;
        gap: 0.5rem;
        color: rgba(var(--foreground-rgb, 232, 232, 236), 0.6);
        font-size: 0.875rem;
      }

      .separator {
        padding: 0 0.25rem;
      }

      .video-actions {
        display: flex;
        gap: 0.75rem;
      }

      .action-button {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 999px;
        background: rgba(var(--background-rgb, 10, 10, 15), 0.5);
        backdrop-filter: blur(8px);
        color: var(--foreground);
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 500;
        transition: all var(--animation-duration-fast, 0.15s)
          var(--animation-easing, ease);
      }

      .action-button:hover {
        background: rgba(var(--accent-rgb, 99, 102, 241), 0.15);
        border-color: rgba(var(--accent-rgb, 99, 102, 241), 0.3);
      }

      .action-button.active {
        background: rgba(var(--accent-rgb, 99, 102, 241), 0.2);
        border-color: rgba(var(--accent-rgb, 99, 102, 241), 0.4);
        color: var(--accent, #6366f1);
        box-shadow: 0 0 20px rgba(var(--accent-rgb, 99, 102, 241), 0.3);
      }

      .icon {
        font-size: 1.25rem;
      }

      .channel-section {
        margin-bottom: 2rem;
      }

      .related-videos {
        margin-top: 2rem;
      }

      .related-videos h3 {
        font-family: var(--font-heading, system-ui);
        font-size: 1.25rem;
        font-weight: 700;
        margin-bottom: 1rem;
        padding-left: 1rem;
        border-left: 3px solid var(--accent, #6366f1);
        color: var(--foreground);
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

      @media (max-width: 768px) {
        .video-metadata {
          flex-direction: column;
          align-items: flex-start;
          gap: 1rem;
        }

        .video-actions {
          width: 100%;
          justify-content: flex-start;
        }
      }
    `,
  ],
})
export class WatchComponent implements OnInit {
  video: VideoDto | null = null;
  videoId: string | null = null;
  loading = false;
  error: string | null = null;
  isLiked = false;
  isSubscribed = false;
  viewRecorded = false;

  constructor(
    private route: ActivatedRoute,
    private videoService: VideoService,
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      this.videoId = params.get('id');
      if (this.videoId) {
        this.loadVideo(this.videoId);
      }
    });
  }

  loadVideo(id: string) {
    this.loading = true;
    this.error = null;

    this.videoService.getVideo(id).subscribe({
      next: (video) => {
        this.video = video;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load video';
        this.loading = false;
        console.error('Error loading video:', err);
      },
    });
  }

  getVideoUrl(assetId: string): string {
    return this.videoService.getVideoUrl(assetId);
  }

  getHlsUrl(assetId?: string): string | null {
    return this.videoService.getHlsUrl(assetId);
  }

  onVideoPlay() {
    // Record view only once
    if (!this.viewRecorded && this.videoId) {
      this.videoService.incrementViewCount(this.videoId).subscribe({
        next: () => {
          this.viewRecorded = true;
          if (this.video) {
            this.video.viewCount++;
          }
        },
        error: (err) => console.error('Failed to record view:', err),
      });
    }
  }

  onVideoEnded() {
    console.log('Video ended');
    // Could load next video or suggestions
  }

  toggleLike() {
    if (!this.videoId) return;

    if (this.isLiked) {
      this.videoService.unlikeVideo(this.videoId).subscribe({
        next: () => {
          this.isLiked = false;
          if (this.video) {
            this.video.likeCount--;
          }
        },
        error: (err) => console.error('Failed to unlike video:', err),
      });
    } else {
      this.videoService.likeVideo(this.videoId).subscribe({
        next: () => {
          this.isLiked = true;
          if (this.video) {
            this.video.likeCount++;
          }
        },
        error: (err) => console.error('Failed to like video:', err),
      });
    }
  }

  shareVideo() {
    if (this.video) {
      const url = window.location.href;
      navigator.clipboard.writeText(url).then(
        () => alert('Link copied to clipboard!'),
        () => alert('Failed to copy link'),
      );
    }
  }

  onSubscribe(channelId: string) {
    // Would need user info from auth service
    console.log('Subscribe to channel:', channelId);
    this.isSubscribed = true;
  }

  onUnsubscribe(channelId: string) {
    console.log('Unsubscribe from channel:', channelId);
    this.isSubscribed = false;
  }
}
