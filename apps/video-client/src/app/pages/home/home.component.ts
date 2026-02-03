import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { VideoService } from '../../services/video.service';
import { VideoDto } from '@optimistic-tanuki/ui-models';
import { VideoGridComponent } from '@optimistic-tanuki/video-ui';

@Component({
  selector: 'video-home',
  standalone: true,
  imports: [CommonModule, RouterLink, VideoGridComponent],
  template: `
    <div class="home-page">
      <header class="page-header">
        <h1>Recommended Videos</h1>
      </header>

      <section class="video-section">
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
        <p>Loading videos...</p>
      </div>

      <div *ngIf="error" class="error">
        <p>{{ error }}</p>
      </div>
    </div>
  `,
  styles: [`
    .home-page {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }

    .page-header {
      margin-bottom: 2rem;
    }

    .page-header h1 {
      font-size: 2rem;
      font-weight: 600;
      margin: 0;
    }

    .video-section {
      margin-bottom: 3rem;
    }

    .video-section h2 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 1.5rem;
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
