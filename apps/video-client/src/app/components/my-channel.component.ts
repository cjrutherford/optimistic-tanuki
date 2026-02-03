import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { VideoService } from '../services/video.service';
import { ProfileService } from '../services/profile.service';
import { ChannelDto, VideoDto } from '@optimistic-tanuki/ui-models';
import { ChannelHeaderComponent, VideoGridComponent } from '@optimistic-tanuki/video-ui';

@Component({
  selector: 'app-my-channel',
  standalone: true,
  imports: [CommonModule, ChannelHeaderComponent, VideoGridComponent],
  template: `
    <div class="my-channel">
      <div class="channel-header-section" *ngIf="channel">
        <channel-header 
          [channel]="channel"
          [isSubscribed]="false"
          (subscribe)="onSubscribe($event)"
        ></channel-header>
      </div>

      <div class="channel-content">
        <div class="channel-tabs">
          <button 
            class="tab-button"
            [class.active]="activeTab === 'videos'"
            (click)="activeTab = 'videos'">
            Videos ({{ videos.length }})
          </button>
          <button 
            class="tab-button"
            [class.active]="activeTab === 'analytics'"
            (click)="activeTab = 'analytics'">
            Analytics
          </button>
          <button 
            class="tab-button"
            [class.active]="activeTab === 'settings'"
            (click)="activeTab = 'settings'">
            Settings
          </button>
        </div>

        <div class="tab-content">
          <div *ngIf="activeTab === 'videos'" class="videos-tab">
            <div class="videos-header">
              <h2>Your Videos</h2>
              <button class="upload-button" (click)="goToUpload()">
                + Upload Video
              </button>
            </div>
            <video-grid [videos]="videos" (videoClick)="onVideoClick($event)"></video-grid>
          </div>

          <div *ngIf="activeTab === 'analytics'" class="analytics-tab">
            <h2>Channel Analytics</h2>
            <div class="stats-grid">
              <div class="stat-card">
                <h3>Total Views</h3>
                <p class="stat-value">{{ getTotalViews() | number }}</p>
              </div>
              <div class="stat-card">
                <h3>Total Videos</h3>
                <p class="stat-value">{{ videos.length }}</p>
              </div>
              <div class="stat-card">
                <h3>Subscribers</h3>
                <p class="stat-value">{{ channel?.subscriberCount || 0 | number }}</p>
              </div>
            </div>
          </div>

          <div *ngIf="activeTab === 'settings'" class="settings-tab">
            <h2>Channel Settings</h2>
            <p>Channel settings coming soon...</p>
          </div>
        </div>
      </div>

      <div class="no-channel" *ngIf="!channel && !loading">
        <h2>You don't have a channel yet</h2>
        <p>Create a channel to start uploading videos</p>
        <button class="create-button" (click)="createChannel()">Create Channel</button>
      </div>
    </div>
  `,
  styles: [`
    .my-channel {
      min-height: 100vh;
    }

    .channel-content {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .channel-tabs {
      display: flex;
      gap: 1rem;
      border-bottom: 1px solid #ddd;
      margin-bottom: 2rem;
    }

    .tab-button {
      padding: 0.75rem 1.5rem;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 500;
      border-bottom: 2px solid transparent;
      transition: border-color 0.2s;
    }

    .tab-button.active {
      border-bottom-color: #2196f3;
      color: #2196f3;
    }

    .videos-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }

    .videos-header h2 {
      margin: 0;
    }

    .upload-button,
    .create-button {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 4px;
      background: #2196f3;
      color: white;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .upload-button:hover,
    .create-button:hover {
      background: #1976d2;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin-top: 1.5rem;
    }

    .stat-card {
      padding: 1.5rem;
      border: 1px solid #ddd;
      border-radius: 8px;
    }

    .stat-card h3 {
      margin: 0 0 0.5rem 0;
      font-size: 0.875rem;
      opacity: 0.7;
    }

    .stat-value {
      margin: 0;
      font-size: 2rem;
      font-weight: 600;
    }

    .no-channel {
      padding: 4rem 2rem;
      text-align: center;
    }

    .no-channel h2 {
      margin: 0 0 1rem 0;
    }

    .no-channel p {
      margin: 0 0 2rem 0;
      opacity: 0.7;
    }
  `]
})
export class MyChannelComponent implements OnInit {
  private readonly videoService = inject(VideoService);
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  
  channel: ChannelDto | null = null;
  videos: VideoDto[] = [];
  activeTab: 'videos' | 'analytics' | 'settings' = 'videos';
  loading = true;

  async ngOnInit() {
    try {
      const profile = this.profileService.getCurrentUserProfile();
      if (profile) {
        // Try to get user's channel
        const channels = await this.videoService.getMyChannels();
        if (channels.length > 0) {
          this.channel = channels[0];
          this.videos = await this.videoService.getChannelVideos(this.channel.id);
        }
      }
    } catch (error) {
      console.error('Error loading channel:', error);
    } finally {
      this.loading = false;
    }
  }

  async createChannel() {
    const profile = this.profileService.getCurrentUserProfile();
    if (!profile) {
      this.router.navigate(['/login']);
      return;
    }

    try {
      this.channel = await this.videoService.createChannel({
        name: `${profile.handle}'s Channel`,
        description: 'My video channel',
      });
    } catch (error) {
      console.error('Error creating channel:', error);
    }
  }

  onVideoClick(video: VideoDto) {
    this.router.navigate(['/watch', video.id]);
  }

  goToUpload() {
    this.router.navigate(['/upload']);
  }

  onSubscribe(channelId: string) {
    // User can't subscribe to their own channel
  }

  getTotalViews(): number {
    return this.videos.reduce((sum, video) => sum + (video.viewCount || 0), 0);
  }
}
