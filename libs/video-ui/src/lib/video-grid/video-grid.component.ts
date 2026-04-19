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
        *ngFor="let video of videos; let i = index"
        [video]="video"
        [animationDelay]="i * 80"
        (cardClick)="onVideoClick($event)"
      ></video-card>
    </div>
  `,
  styles: [
    `
      .video-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 2rem 1.5rem;
        padding: 1.5rem;
      }

      @media (max-width: 768px) {
        .video-grid {
          grid-template-columns: 1fr;
          gap: 1.5rem;
          padding: 1rem;
        }
      }
    `,
  ],
})
export class VideoGridComponent {
  @Input() videos: VideoDto[] = [];
  @Output() videoClick = new EventEmitter<VideoDto>();

  onVideoClick(video: VideoDto) {
    this.videoClick.emit(video);
  }
}
