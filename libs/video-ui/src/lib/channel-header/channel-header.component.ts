import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Channel {
  id: string;
  name: string;
  description?: string;
  avatarAssetId?: string;
  bannerAssetId?: string;
  subscriberCount?: number;
}

@Component({
  selector: 'channel-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="channel-header">
      <div class="channel-banner" *ngIf="channel.bannerAssetId" 
           [style.backgroundImage]="'url(/api/asset/' + channel.bannerAssetId + ')'">
      </div>
      
      <div class="channel-info-container">
        <div class="channel-avatar" *ngIf="channel.avatarAssetId">
          <img [src]="'/api/asset/' + channel.avatarAssetId" [alt]="channel.name" />
        </div>
        
        <div class="channel-details">
          <h1>{{ channel.name }}</h1>
          <div class="channel-meta">
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
      color: #606060;
      font-size: 0.875rem;
      margin-bottom: 0.75rem;
    }

    .channel-description {
      color: #030303;
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
      background: #cc0000;
      color: white;
      font-weight: 500;
      cursor: pointer;
      text-transform: uppercase;
      font-size: 0.875rem;
      letter-spacing: 0.5px;
      transition: background 0.2s;
    }

    .subscribe-button:hover:not(:disabled) {
      background: #a80000;
    }

    .subscribe-button.subscribed {
      background: #909090;
    }

    .subscribe-button.subscribed:hover:not(:disabled) {
      background: #606060;
    }

    .subscribe-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `]
})
export class ChannelHeaderComponent {
  @Input() channel!: Channel;
  @Input() isSubscribed = false;
  @Input() subscribing = false;
  
  @Output() subscribe = new EventEmitter<string>();
  @Output() unsubscribe = new EventEmitter<string>();

  onSubscribeClick() {
    if (this.isSubscribed) {
      this.unsubscribe.emit(this.channel.id);
    } else {
      this.subscribe.emit(this.channel.id);
    }
  }
}
