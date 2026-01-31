import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Video {
  id: string;
  title: string;
  description?: string;
  thumbnailAssetId?: string;
  channelId: string;
  viewCount: number;
  createdAt: Date;
  durationSeconds?: number;
  channel?: {
    id: string;
    name: string;
    avatarAssetId?: string;
  };
}

@Component({
  selector: 'video-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="video-card" (click)="onCardClick()">
      <div class="thumbnail-container">
        <img 
          *ngIf="video.thumbnailAssetId"
          [src]="'/api/asset/' + video.thumbnailAssetId" 
          [alt]="video.title"
          class="thumbnail"
        />
        <div *ngIf="!video.thumbnailAssetId" class="thumbnail-placeholder">
          <span>No thumbnail</span>
        </div>
        
        <span class="duration" *ngIf="video.durationSeconds">
          {{ formatDuration(video.durationSeconds) }}
        </span>
      </div>
      
      <div class="video-details">
        <div class="channel-avatar" *ngIf="video.channel?.avatarAssetId">
          <img [src]="'/api/asset/' + video.channel.avatarAssetId" [alt]="video.channel.name" />
        </div>
        
        <div class="video-info">
          <h3 class="video-title" [title]="video.title">{{ video.title }}</h3>
          
          <div class="video-meta">
            <span class="channel-name" *ngIf="video.channel">{{ video.channel.name }}</span>
            <div class="video-stats">
              <span>{{ video.viewCount | number }} views</span>
              <span>•</span>
              <span>{{ getTimeAgo(video.createdAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .video-card {
      cursor: pointer;
      transition: transform 0.2s;
    }

    .video-card:hover {
      transform: translateY(-2px);
    }

    .thumbnail-container {
      position: relative;
      width: 100%;
      padding-bottom: 56.25%; /* 16:9 aspect ratio */
      background: #f0f0f0;
      border-radius: 8px;
      overflow: hidden;
    }

    .thumbnail {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .thumbnail-placeholder {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #e0e0e0;
      color: #606060;
    }

    .duration {
      position: absolute;
      bottom: 8px;
      right: 8px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 2px 6px;
      border-radius: 2px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .video-details {
      display: flex;
      gap: 0.75rem;
      margin-top: 0.75rem;
    }

    .channel-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
    }

    .channel-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .video-info {
      flex: 1;
      min-width: 0;
    }

    .video-title {
      margin: 0 0 0.25rem 0;
      font-size: 0.875rem;
      font-weight: 500;
      line-height: 1.3;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .video-meta {
      font-size: 0.75rem;
      color: #606060;
    }

    .channel-name {
      display: block;
      margin-bottom: 0.125rem;
    }

    .video-stats {
      display: flex;
      gap: 0.25rem;
    }
  `]
})
export class VideoCardComponent {
  @Input() video!: Video;
  @Output() cardClick = new EventEmitter<Video>();

  onCardClick() {
    this.cardClick.emit(this.video);
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  getTimeAgo(date: Date): string {
    const now = new Date();
    const secondsAgo = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

    if (secondsAgo < 60) return 'just now';
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)} minutes ago`;
    if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)} hours ago`;
    if (secondsAgo < 604800) return `${Math.floor(secondsAgo / 86400)} days ago`;
    if (secondsAgo < 2592000) return `${Math.floor(secondsAgo / 604800)} weeks ago`;
    if (secondsAgo < 31536000) return `${Math.floor(secondsAgo / 2592000)} months ago`;
    return `${Math.floor(secondsAgo / 31536000)} years ago`;
  }
}
