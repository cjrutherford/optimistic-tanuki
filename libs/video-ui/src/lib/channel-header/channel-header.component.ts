import { Component, Input, Output, EventEmitter, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChannelDto } from '@optimistic-tanuki/ui-models';
import { ThemeService, ThemeColors } from '@optimistic-tanuki/theme-lib';
import { Subscription } from 'rxjs';

@Component({
  selector: 'channel-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="channel-header" [ngStyle]="headerStyles">
      <div class="channel-banner" *ngIf="channel.bannerAssetId" 
           [style.backgroundImage]="'url(/api/asset/' + channel.bannerAssetId + ')'">
      </div>
      
      <div class="channel-info-container">
        <div class="channel-avatar" *ngIf="channel.avatarAssetId">
          <img [src]="'/api/asset/' + channel.avatarAssetId" [alt]="channel.name" />
        </div>
        
        <div class="channel-details">
          <h1>{{ channel.name }}</h1>
          <div class="channel-meta" [ngStyle]="metaStyles">
            <span class="subscriber-count" *ngIf="channel.subscriberCount">
              {{ channel.subscriberCount | number }} subscribers
            </span>
          </div>
          <p class="channel-description" *ngIf="channel.description">
            {{ channel.description }}
          </p>
        </div>
        
        <div class="channel-actions">
          <button 
            class="subscribe-button"
            [class.subscribed]="isSubscribed"
            [ngStyle]="buttonStyles"
            (click)="onSubscribeClick()"
            [disabled]="subscribing"
          >
            {{ isSubscribed ? 'Subscribed' : 'Subscribe' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .channel-header {
      width: 100%;
    }

    .channel-banner {
      width: 100%;
      height: 200px;
      background-size: cover;
      background-position: center;
      background-color: #e0e0e0;
    }

    .channel-info-container {
      padding: 1.5rem;
      display: flex;
      gap: 1.5rem;
      align-items: flex-start;
    }

    .channel-avatar {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
    }

    .channel-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .channel-details {
      flex: 1;
    }

    .channel-details h1 {
      margin: 0 0 0.5rem 0;
      font-size: 1.75rem;
      font-weight: 600;
    }

    .channel-meta {
      font-size: 0.875rem;
      margin-bottom: 0.75rem;
    }

    .channel-description {
      line-height: 1.6;
      margin: 0;
    }

    .channel-actions {
      display: flex;
      align-items: center;
    }

    .subscribe-button {
      padding: 0.625rem 1rem;
      border: none;
      border-radius: 2px;
      font-weight: 500;
      cursor: pointer;
      text-transform: uppercase;
      font-size: 0.875rem;
      letter-spacing: 0.5px;
      transition: background 0.2s, opacity 0.2s;
    }

    .subscribe-button:hover:not(:disabled) {
      opacity: 0.9;
    }

    .subscribe-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `]
})
export class ChannelHeaderComponent implements OnInit, OnDestroy {
  private themeService = inject(ThemeService);
  private themeSub?: Subscription;
  
  headerStyles: any = {};
  metaStyles: any = {};
  buttonStyles: any = {};
  
  @Input() channel!: ChannelDto;
  @Input() isSubscribed = false;
  @Input() subscribing = false;
  
  @Output() subscribe = new EventEmitter<string>();
  @Output() unsubscribe = new EventEmitter<string>();

  ngOnInit() {
    this.themeSub = this.themeService.themeColors$.subscribe((colors: ThemeColors | undefined) => {
      if (colors) {
        this.headerStyles = {
          background: colors.background,
          color: colors.foreground,
        };
        this.metaStyles = {
          color: colors.foreground,
          opacity: 0.7,
        };
        this.buttonStyles = {
          background: this.isSubscribed ? colors.foreground : colors.accent,
          color: this.isSubscribed ? colors.background : colors.background,
        };
      }
    });
  }

  ngOnDestroy() {
    if (this.themeSub) {
      this.themeSub.unsubscribe();
    }
  }

  onSubscribeClick() {
    if (this.isSubscribed) {
      this.unsubscribe.emit(this.channel.id);
    } else {
      this.subscribe.emit(this.channel.id);
    }
  }
}
