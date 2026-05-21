import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { VideoService } from '../services/video.service';
import { VideoDto } from '@optimistic-tanuki/ui-models';
import { VideoCardComponent } from '@optimistic-tanuki/video-ui';

interface VideoViewHistory {
  video: VideoDto;
  viewedAt: Date;
  watchDuration: number;
}

@Component({
  selector: 'app-view-history',
  standalone: true,
  imports: [CommonModule, VideoCardComponent],
  template: `
    <div class="view-history">
      <h1>Watch History</h1>
      
      <div class="history-list" *ngIf="history.length > 0">
        <div *ngFor="let item of history" class="history-item">
          <video-card [video]="item.video" (cardClick)="onVideoClick($event)"></video-card>
          <div class="watch-info">
            <span class="watched-date">Watched {{ getTimeAgo(item.viewedAt) }}</span>
            <span class="watch-duration" *ngIf="item.watchDuration">
              • Watched {{ formatDuration(item.watchDuration) }}
            </span>
          </div>
        </div>
      </div>

      <div class="empty-state" *ngIf="history.length === 0">
        <p>No watch history yet. Start watching videos to see them here!</p>
      </div>
    </div>
  `,
  styles: [`
    .view-history {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    h1 {
      margin: 0 0 2rem 0;
    }

    .history-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 2rem 1rem;
    }

    .history-item {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .watch-info {
      font-size: 0.75rem;
      opacity: 0.7;
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      opacity: 0.6;
    }
  `]
})
export class ViewHistoryComponent implements OnInit {
  private readonly videoService = inject(VideoService);
  private readonly router = inject(Router);
  
  history: VideoViewHistory[] = [];

  async ngOnInit() {
    // TODO: Implement API endpoint to fetch user's view history
    // For now, this is a placeholder
    this.history = [];
  }

  onVideoClick(video: VideoDto) {
    this.router.navigate(['/watch', video.id]);
  }

  getTimeAgo(date: Date): string {
    const now = new Date();
    const secondsAgo = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

    if (secondsAgo < 60) return 'just now';
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)} minutes ago`;
    if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)} hours ago`;
    if (secondsAgo < 604800) return `${Math.floor(secondsAgo / 86400)} days ago`;
    return `${Math.floor(secondsAgo / 604800)} weeks ago`;
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
}
