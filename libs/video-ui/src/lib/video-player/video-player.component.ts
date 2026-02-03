import { Component, Input, AfterViewInit, ViewChild, ElementRef, Output, EventEmitter, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService, ThemeColors } from '@optimistic-tanuki/theme-lib';
import { Subscription } from 'rxjs';

@Component({
  selector: 'video-player',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="video-player-container" [ngStyle]="containerStyles">
      <video
        #videoElement
        class="video-element"
        [controls]="true"
        [autoplay]="autoplay"
        (play)="onPlay()"
        (pause)="onPause()"
        (ended)="onEnded()"
        (timeupdate)="onTimeUpdate()"
      >
        <source [src]="videoUrl" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      
      <div class="video-info" *ngIf="title" [ngStyle]="infoStyles">
        <h2>{{ title }}</h2>
        <p *ngIf="description">{{ description }}</p>
      </div>
    </div>
  `,
  styles: [`
    .video-player-container {
      width: 100%;
      max-width: 100%;
      background: #000;
      position: relative;
    }

    .video-element {
      width: 100%;
      height: auto;
      max-height: 70vh;
      display: block;
    }

    .video-info {
      padding: 1rem;
    }

    .video-info h2 {
      margin: 0 0 0.5rem 0;
      font-size: 1.5rem;
      font-weight: 600;
    }

    .video-info p {
      margin: 0;
      opacity: 0.8;
      line-height: 1.5;
    }
  `]
})
export class VideoPlayerComponent implements AfterViewInit, OnInit, OnDestroy {
  private themeService = inject(ThemeService);
  private themeSub?: Subscription;
  
  containerStyles: any = {};
  infoStyles: any = {};
  @Input() videoUrl!: string;
  @Input() title?: string;
  @Input() description?: string;
  @Input() autoplay = false;
  
  @Output() play = new EventEmitter<void>();
  @Output() pause = new EventEmitter<void>();
  @Output() ended = new EventEmitter<void>();
  @Output() timeUpdate = new EventEmitter<number>();
  
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;

  ngOnInit() {
    this.themeSub = this.themeService.themeColors$.subscribe((colors: ThemeColors | undefined) => {
      if (colors) {
        this.infoStyles = {
          background: colors.background,
          color: colors.foreground,
        };
        this.containerStyles = {
          borderColor: colors.accent,
        };
      }
    });
  }

  ngAfterViewInit() {
    // Video element is now available
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
