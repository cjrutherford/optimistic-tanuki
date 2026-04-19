import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { VideoService } from '../../services/video.service';
import { VideoDto } from '@optimistic-tanuki/ui-models';
import { VideoGridComponent } from '@optimistic-tanuki/video-ui';
import { AuroraRibbonComponent } from '@optimistic-tanuki/motion-ui';

@Component({
  selector: 'video-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    VideoGridComponent,
    AuroraRibbonComponent,
  ],
  template: `
    <div class="home-page">
      <section class="hero">
        <div class="hero-background">
          <otui-aurora-ribbon
            height="400px"
            [density]="8"
            [speed]="0.4"
            [intensity]="0.6"
          ></otui-aurora-ribbon>
        </div>
        <div class="hero-content">
          <h1 class="hero-title">Discover & Stream</h1>
          <p class="hero-subtitle">
            Explore trending content, find your next favorite creator, and dive
            into a world of video.
          </p>
        </div>
      </section>

      <section class="video-section">
        <h2>Recommended Videos</h2>
        <video-grid
          [videos]="recommendedVideos"
          (videoClick)="navigateToVideo($event)"
        ></video-grid>
      </section>

      <section class="video-section" *ngIf="trendingVideos.length > 0">
        <h2>Trending Now</h2>
        <video-grid
          [videos]="trendingVideos"
          (videoClick)="navigateToVideo($event)"
        ></video-grid>
      </section>

      <div *ngIf="loading" class="loading">
        <div class="shimmer-loader">
          <div class="shimmer-bar"></div>
          <div class="shimmer-bar short"></div>
        </div>
      </div>

      <div *ngIf="error" class="error">
        <p>{{ error }}</p>
      </div>
    </div>
  `,
  styles: [
    `
      .home-page {
        max-width: 1400px;
        margin: 0 auto;
        padding: 0 1rem 2rem;
      }

      .hero {
        position: relative;
        min-height: 360px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 3rem;
        overflow: hidden;
        border-radius: var(--personality-border-radius, 16px);
      }

      .hero-background {
        position: absolute;
        inset: 0;
        z-index: 0;
        opacity: 0.5;
      }

      .hero-content {
        position: relative;
        z-index: 1;
        text-align: center;
        padding: 3rem 2rem;
      }

      .hero-title {
        font-family: var(--font-heading, system-ui);
        font-size: clamp(2.5rem, 5vw, 4rem);
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--foreground);
        margin: 0 0 1rem;
      }

      .hero-subtitle {
        font-size: 1.125rem;
        color: rgba(var(--foreground-rgb, 232, 232, 236), 0.7);
        max-width: 540px;
        margin: 0 auto;
        line-height: 1.6;
      }

      .video-section {
        margin-bottom: 3rem;
      }

      .video-section h2 {
        font-family: var(--font-heading, system-ui);
        font-size: 1.5rem;
        font-weight: 700;
        margin-bottom: 1.5rem;
        padding-left: 1rem;
        border-left: 3px solid var(--accent, #6366f1);
        color: var(--foreground);
      }

      .loading {
        text-align: center;
        padding: 3rem;
      }

      .shimmer-loader {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
      }

      .shimmer-bar {
        width: 200px;
        height: 12px;
        border-radius: 6px;
        background: linear-gradient(
          90deg,
          rgba(var(--foreground-rgb, 232, 232, 236), 0.06) 0%,
          rgba(var(--foreground-rgb, 232, 232, 236), 0.15) 50%,
          rgba(var(--foreground-rgb, 232, 232, 236), 0.06) 100%
        );
        background-size: 200% 100%;
        animation: shimmer 1.5s ease-in-out infinite;
      }

      .shimmer-bar.short {
        width: 140px;
      }

      @keyframes shimmer {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }

      .error {
        text-align: center;
        padding: 3rem;
        font-size: 1.125rem;
        color: var(--danger, #ef4444);
      }
    `,
  ],
})
export class HomeComponent implements OnInit {
  recommendedVideos: VideoDto[] = [];
  trendingVideos: VideoDto[] = [];
  loading = false;
  error: string | null = null;

  constructor(private videoService: VideoService) {}

  ngOnInit() {
    this.loadVideos();
  }

  loadVideos() {
    this.loading = true;
    this.error = null;

    this.videoService.getRecommendedVideos(20).subscribe({
      next: (videos) => {
        this.recommendedVideos = videos;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load recommended videos';
        this.loading = false;
        console.error('Error loading recommended videos:', err);
      },
    });

    this.videoService.getTrendingVideos(10).subscribe({
      next: (videos) => {
        this.trendingVideos = videos;
      },
      error: (err) => {
        console.error('Error loading trending videos:', err);
      },
    });
  }

  navigateToVideo(video: VideoDto) {
    // Navigation will be handled by router in the template
    window.location.href = `/watch/${video.id}`;
  }
}
