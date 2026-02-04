import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { VideoService } from '../../services/video.service';
import { VideoDto } from '@optimistic-tanuki/ui-models';
import { VideoPlayerComponent, ChannelHeaderComponent } from '@optimistic-tanuki/video-ui';

@Component({
  selector: 'video-watch',
  standalone: true,
  imports: [CommonModule, RouterLink, VideoPlayerComponent, ChannelHeaderComponent],
  template: `
    <div class="watch-page">
      <div class="video-container" *ngIf="video">
        <video-player
          [videoUrl]="getVideoUrl(video.assetId)"
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
  `,
  styles: [`
    .watch-page {
      max-width: 1400px;
      margin: 0 auto;
      padding: 1.5rem;
    }

    .video-container {
      margin-bottom: 2rem;
    }

    .video-metadata {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 0;
      border-bottom: 1px solid #e0e0e0;
      margin-bottom: 1rem;
    }

    .video-stats {
      display: flex;
      gap: 0.5rem;
      color: #606060;
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
      border: 1px solid #e0e0e0;
      border-radius: 18px;
      background: white;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      transition: background 0.2s;
    }

    .action-button:hover {
      background: #f0f0f0;
    }

    .action-button.active {
      background: #e3f2fd;
      border-color: #1976d2;
      color: #1976d2;
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
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }

    .loading,
    .error {
      text-align: center;
      padding: 3rem;
      font-size: 1.125rem;
    }

    .error {
      color: #d32f2f;
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
  `]
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
    private videoService: VideoService
  ) { }

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
        () => alert('Failed to copy link')
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
