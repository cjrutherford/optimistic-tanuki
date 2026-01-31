import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { VideoService, Video, Channel } from '../../services/video.service';
import { ChannelHeaderComponent, VideoGridComponent } from '@optimistic-tanuki/video-ui';

@Component({
  selector: 'video-channel',
  standalone: true,
  imports: [CommonModule, RouterLink, ChannelHeaderComponent, VideoGridComponent],
  template: `
    <div class="channel-page">
      <div *ngIf="channel">
        <channel-header
          [channel]="channel"
          [isSubscribed]="isSubscribed"
          (subscribe)="onSubscribe($event)"
          (unsubscribe)="onUnsubscribe($event)"
        ></channel-header>

        <div class="channel-content">
          <nav class="channel-nav">
            <button class="nav-tab active">Videos</button>
            <button class="nav-tab">About</button>
          </nav>

          <div class="videos-section">
            <video-grid
              [videos]="channelVideos"
              (videoClick)="navigateToVideo($event)"
            ></video-grid>

            <div *ngIf="channelVideos.length === 0 && !loading" class="no-videos">
              <p>This channel hasn't uploaded any videos yet.</p>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="loading" class="loading">
        <p>Loading channel...</p>
      </div>

      <div *ngIf="error" class="error">
        <p>{{ error }}</p>
      </div>
    </div>
  `,
  styles: [`
    .channel-page {
      max-width: 1400px;
      margin: 0 auto;
    }

    .channel-content {
      padding: 0 1.5rem 2rem;
    }

    .channel-nav {
      display: flex;
      gap: 1rem;
      border-bottom: 1px solid #e0e0e0;
      margin-bottom: 2rem;
    }

    .nav-tab {
      padding: 1rem 0;
      border: none;
      background: none;
      font-size: 0.875rem;
      font-weight: 500;
      color: #606060;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }

    .nav-tab:hover {
      color: #030303;
    }

    .nav-tab.active {
      color: #030303;
      border-bottom-color: #030303;
    }

    .videos-section {
      min-height: 400px;
    }

    .no-videos {
      text-align: center;
      padding: 4rem 2rem;
      color: #606060;
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
  `]
})
export class ChannelComponent implements OnInit {
  channel: Channel | null = null;
  channelVideos: Video[] = [];
  channelId: string | null = null;
  loading = false;
  error: string | null = null;
  isSubscribed = false;

  constructor(
    private route: ActivatedRoute,
    private videoService: VideoService
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      this.channelId = params.get('id');
      if (this.channelId) {
        this.loadChannel(this.channelId);
        this.loadChannelVideos(this.channelId);
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
      },
      error: (err) => {
        this.error = 'Failed to load channel';
        this.loading = false;
        console.error('Error loading channel:', err);
      },
    });
  }

  loadChannelVideos(channelId: string) {
    this.videoService.getChannelVideos(channelId).subscribe({
      next: (videos) => {
        this.channelVideos = videos;
      },
      error: (err) => {
        console.error('Error loading channel videos:', err);
      },
    });
  }

  navigateToVideo(video: Video) {
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
