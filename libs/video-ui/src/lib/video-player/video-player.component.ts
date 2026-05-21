import {
  Component,
  Input,
  AfterViewInit,
  ViewChild,
  ElementRef,
  Output,
  EventEmitter,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService, ThemeColors } from '@optimistic-tanuki/theme-lib';
import { Subscription } from 'rxjs';

@Component({
  selector: 'video-player',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="video-player-container">
      <div class="ambient-glow"></div>
      <video
        #videoElement
        class="video-element"
        [controls]="true"
        [autoplay]="autoplay"
        (play)="onPlay()"
        (pause)="onPause()"
        (ended)="onEnded()"
        (timeupdate)="onTimeUpdate()"
      ></video>

      <div class="video-info" *ngIf="title">
        <h2>{{ title }}</h2>
        <p *ngIf="description">{{ description }}</p>
      </div>
    </div>
  `,
  styles: [
    `
      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      :host {
        display: block;
      }

      .video-player-container {
        width: 100%;
        max-width: 100%;
        position: relative;
        border-radius: var(--personality-border-radius, 12px);
        overflow: hidden;
        background: rgba(var(--background-rgb, 0, 0, 0), 0.9);
        animation: fadeIn var(--animation-duration-normal, 0.5s)
          var(--animation-easing, cubic-bezier(0.4, 0, 0.2, 1)) both;
      }

      .ambient-glow {
        position: absolute;
        inset: -40px;
        z-index: -1;
        border-radius: inherit;
        box-shadow: 0 0 80px 20px rgba(var(--accent-rgb, 100, 100, 255), 0.15);
        pointer-events: none;
      }

      .video-element {
        width: 100%;
        height: auto;
        max-height: 70vh;
        display: block;
      }

      .video-info {
        padding: 1.5rem;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        background: rgba(var(--background-rgb, 0, 0, 0), 0.7);
        border-top: 1px solid rgba(255, 255, 255, 0.06);
      }

      .video-info h2 {
        margin: 0 0 0.5rem 0;
        font-family: var(--font-heading, inherit);
        font-size: 1.75rem;
        font-weight: 700;
        color: var(--foreground, #fff);
        text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
      }

      .video-info p {
        margin: 0;
        font-family: var(--font-body, inherit);
        color: rgba(var(--foreground-rgb, 255, 255, 255), 0.65);
        line-height: 1.6;
        font-size: 0.95rem;
      }
    `,
  ],
})
export class VideoPlayerComponent implements AfterViewInit, OnInit, OnDestroy {
  private themeService = inject(ThemeService);
  private themeSub?: Subscription;

  @Input() videoUrl!: string;
  @Input() hlsUrl?: string | null;
  @Input() title?: string;
  @Input() description?: string;
  @Input() autoplay = false;

  @Output() play = new EventEmitter<void>();
  @Output() pause = new EventEmitter<void>();
  @Output() ended = new EventEmitter<void>();
  @Output() timeUpdate = new EventEmitter<number>();

  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;

  ngOnInit() {
    this.themeSub = this.themeService.themeColors$.subscribe(
      (colors: ThemeColors | undefined) => {
        // Theme colors now applied via CSS custom properties
      },
    );
  }

  ngAfterViewInit() {
    const video = this.videoElement.nativeElement;
    const canPlayHls =
      !!this.hlsUrl &&
      typeof video.canPlayType === 'function' &&
      video.canPlayType('application/vnd.apple.mpegurl') !== '';

    video.src = canPlayHls ? this.hlsUrl! : this.videoUrl;
  }

  ngOnDestroy() {
    if (this.themeSub) {
      this.themeSub.unsubscribe();
    }
  }

  onPlay() {
    this.play.emit();
  }

  onPause() {
    this.pause.emit();
  }

  onEnded() {
    this.ended.emit();
  }

  onTimeUpdate() {
    if (this.videoElement) {
      this.timeUpdate.emit(this.videoElement.nativeElement.currentTime);
    }
  }

  // Public methods for controlling playback
  playVideo() {
    this.videoElement.nativeElement.play();
  }

  pauseVideo() {
    this.videoElement.nativeElement.pause();
  }

  seekTo(time: number) {
    this.videoElement.nativeElement.currentTime = time;
  }

  getCurrentTime(): number {
    return this.videoElement.nativeElement.currentTime;
  }

  getDuration(): number {
    return this.videoElement.nativeElement.duration;
  }
}
