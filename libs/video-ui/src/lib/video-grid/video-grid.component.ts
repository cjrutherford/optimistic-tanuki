import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoCardComponent } from '../video-card/video-card.component';
import { VideoDto } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'video-grid',
  standalone: true,
  imports: [CommonModule, VideoCardComponent],
  template: `
    <div class="video-grid">
      <video-card
        *ngFor="let video of videos"
        [video]="video"
        (cardClick)="onVideoClick($event)"
      ></video-card>
    </div>
  `,
  styles: [`
    .video-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem 1rem;
      padding: 1rem 0;
    }

    @media (max-width: 768px) {
      .video-grid {
        grid-template-columns: 1fr;
        gap: 1.5rem;
      }
    }
  `]
})
export class VideoGridComponent {
  @Input() videos: VideoDto[] = [];
  @Output() videoClick = new EventEmitter<VideoDto>();

  onVideoClick(video: VideoDto) {
    this.videoClick.emit(video);
  }
}
