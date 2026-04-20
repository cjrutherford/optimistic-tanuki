import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoDto } from '@optimistic-tanuki/ui-models';
import { ThemeService, ThemeColors } from '@optimistic-tanuki/theme-lib';
import { Subscription } from 'rxjs';

@Component({
  selector: 'video-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="video-card"
      tabindex="0"
      (click)="onCardClick()"
      (keydown.enter)="onCardClick()"
      (keyup.space)="onCardClick()"
      [style.animation-delay.ms]="animationDelay"
    >
      <div class="thumbnail-container">
        <img
          *ngIf="video.thumbnailAssetId"
          [src]="'/api/asset/' + video.thumbnailAssetId"
          [alt]="video.title"
          class="thumbnail"
        />
        <div *ngIf="!video.thumbnailAssetId" class="thumbnail-placeholder">
          <div class="shimmer-skeleton"></div>
          <span>No thumbnail</span>
        </div>

        <div class="thumbnail-overlay"></div>

        <span class="duration" *ngIf="video.durationSeconds">
          {{ formatDuration(video.durationSeconds) }}
        </span>
      </div>

      <div class="video-details">
        <div class="channel-avatar" *ngIf="video.channel?.avatarAssetId">
          <img
            [src]="'/api/asset/' + video.channel?.avatarAssetId"
            [alt]="video.channel?.name"
          />
        </div>

        <div class="video-info">
          <h3 class="video-title" [title]="video.title">{{ video.title }}</h3>

          <div class="video-meta">
            <span class="channel-name" *ngIf="video.channel">{{
              video.channel.name
            }}</span>
            <div class="video-stats">
              <span>{{ video.viewCount | number }} views</span>
              <span>&middot;</span>
              <span>{{ getTimeAgo(video.createdAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(24px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes shimmer {
        0% {
          background-position: -200% 0;
        }
        100% {
          background-position: 200% 0;
        }
      }

      :host {
        display: block;
      }

      .video-card {
        cursor: pointer;
        border-radius: var(--personality-border-radius, 12px);
        padding: 0.5rem;
        background: rgba(var(--background-rgb, 0, 0, 0), 0.6);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        transition:
          transform var(--animation-duration-normal, 0.3s)
            var(--animation-easing, cubic-bezier(0.4, 0, 0.2, 1)),
          box-shadow var(--animation-duration-normal, 0.3s)
            var(--animation-easing, cubic-bezier(0.4, 0, 0.2, 1));
        animation: fadeInUp var(--animation-duration-normal, 0.5s)
          var(--animation-easing, cubic-bezier(0.4, 0, 0.2, 1)) both;
      }

      .video-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        border-color: rgba(255, 255, 255, 0.12);
      }

      .thumbnail-container {
        position: relative;
        width: 100%;
        padding-bottom: 56.25%;
        border-radius: var(--personality-border-radius, 10px);
        overflow: hidden;
      }

      .thumbnail {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform var(--animation-duration-normal, 0.4s)
          var(--animation-easing, cubic-bezier(0.4, 0, 0.2, 1));
      }

      .video-card:hover .thumbnail {
        transform: scale(1.05);
      }

      .thumbnail-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          to top,
          rgba(0, 0, 0, 0.5) 0%,
          transparent 50%
        );
        opacity: 0;
        transition: opacity var(--animation-duration-fast, 0.2s)
          var(--animation-easing, cubic-bezier(0.4, 0, 0.2, 1));
        pointer-events: none;
      }

      .video-card:hover .thumbnail-overlay {
        opacity: 1;
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
        background: rgba(var(--background-rgb, 0, 0, 0), 0.8);
        color: rgba(var(--foreground-rgb, 255, 255, 255), 0.4);
        overflow: hidden;
      }

      .shimmer-skeleton {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(255, 255, 255, 0.04) 40%,
          rgba(255, 255, 255, 0.08) 50%,
          rgba(255, 255, 255, 0.04) 60%,
          transparent 100%
        );
        background-size: 200% 100%;
        animation: shimmer 2s infinite linear;
      }

      .duration {
        position: absolute;
        bottom: 8px;
        right: 8px;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        color: white;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        border: 1px solid rgba(255, 255, 255, 0.1);
        z-index: 1;
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
        font-family: var(--font-heading, inherit);
        font-size: 0.9rem;
        font-weight: 600;
        line-height: 1.3;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        color: var(--foreground, #fff);
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      }

      .video-meta {
        font-size: 0.75rem;
        color: rgba(var(--foreground-rgb, 255, 255, 255), 0.6);
      }

      .channel-name {
        display: block;
        margin-bottom: 0.125rem;
      }

      .video-stats {
        display: flex;
        gap: 0.25rem;
      }
    `,
  ],
})
export class VideoCardComponent implements OnInit, OnDestroy {
  private themeService = inject(ThemeService);
  private themeSub?: Subscription;

  @Input() video!: VideoDto;
  @Input() animationDelay: number = 0;
  @Output() cardClick = new EventEmitter<VideoDto>();

  ngOnInit() {
    this.themeSub = this.themeService.themeColors$.subscribe(
      (colors: ThemeColors | undefined) => {
        // Theme colors now applied via CSS custom properties
      },
    );
  }

  ngOnDestroy() {
    if (this.themeSub) {
      this.themeSub.unsubscribe();
    }
  }

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
    const secondsAgo = Math.floor(
      (now.getTime() - new Date(date).getTime()) / 1000,
    );

    if (secondsAgo < 60) return 'just now';
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)} minutes ago`;
    if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)} hours ago`;
    if (secondsAgo < 604800)
      return `${Math.floor(secondsAgo / 86400)} days ago`;
    if (secondsAgo < 2592000)
      return `${Math.floor(secondsAgo / 604800)} weeks ago`;
    if (secondsAgo < 31536000)
      return `${Math.floor(secondsAgo / 2592000)} months ago`;
    return `${Math.floor(secondsAgo / 31536000)} years ago`;
  }
}
