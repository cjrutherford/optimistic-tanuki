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
import { ChannelDto } from '@optimistic-tanuki/ui-models';
import { ThemeService, ThemeColors } from '@optimistic-tanuki/theme-lib';
import { AuroraRibbonComponent } from '@optimistic-tanuki/motion-ui';
import { Subscription } from 'rxjs';

@Component({
  selector: 'channel-header',
  standalone: true,
  imports: [CommonModule, AuroraRibbonComponent],
  template: `
    <div class="channel-header">
      <div
        class="channel-banner"
        *ngIf="channel.bannerAssetId"
        [style.backgroundImage]="
          'url(/api/asset/' + channel.bannerAssetId + ')'
        "
      >
        <div class="banner-gradient"></div>
      </div>
      <div class="channel-banner aurora-banner" *ngIf="!channel.bannerAssetId">
        <otui-aurora-ribbon
          [height]="'280px'"
          [density]="3"
          [speed]="0.5"
          [intensity]="0.6"
          [reducedMotion]="false"
        ></otui-aurora-ribbon>
        <div class="banner-gradient"></div>
      </div>

      <div class="channel-info-container">
        <div class="channel-avatar" *ngIf="channel.avatarAssetId">
          <img
            [src]="'/api/asset/' + channel.avatarAssetId"
            [alt]="channel.name"
          />
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

      .channel-header {
        width: 100%;
        color: var(--foreground, #fff);
        animation: fadeIn var(--animation-duration-normal, 0.5s)
          var(--animation-easing, cubic-bezier(0.4, 0, 0.2, 1)) both;
      }

      .channel-banner {
        width: 100%;
        height: 280px;
        background-size: cover;
        background-position: center;
        position: relative;
        overflow: hidden;
      }

      .aurora-banner {
        background: transparent;
      }

      .aurora-banner otui-aurora-ribbon {
        position: absolute;
        inset: 0;
        z-index: 0;
      }

      .banner-gradient {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          to bottom,
          transparent 40%,
          rgba(var(--background-rgb, 0, 0, 0), 0.6) 75%,
          var(--background, #000) 100%
        );
        z-index: 1;
      }

      .channel-info-container {
        padding: 1.5rem 2rem;
        display: flex;
        gap: 1.5rem;
        align-items: flex-start;
        position: relative;
        z-index: 2;
        margin-top: -3rem;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }

      .channel-avatar {
        width: 100px;
        height: 100px;
        border-radius: 50%;
        overflow: hidden;
        flex-shrink: 0;
        box-shadow:
          0 0 0 3px rgba(var(--accent-rgb, 100, 100, 255), 0.4),
          0 0 20px 4px rgba(var(--accent-rgb, 100, 100, 255), 0.15);
        border: 3px solid rgba(var(--accent-rgb, 100, 100, 255), 0.5);
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
        font-family: var(--font-heading, inherit);
        font-size: 2rem;
        font-weight: 700;
        letter-spacing: -0.02em;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }

      .channel-meta {
        font-size: 0.875rem;
        margin-bottom: 0.75rem;
        color: rgba(var(--foreground-rgb, 255, 255, 255), 0.6);
      }

      .channel-description {
        line-height: 1.6;
        margin: 0;
        font-family: var(--font-body, inherit);
        color: rgba(var(--foreground-rgb, 255, 255, 255), 0.7);
      }

      .channel-actions {
        display: flex;
        align-items: center;
      }

      .subscribe-button {
        padding: 0.7rem 1.5rem;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: var(--personality-border-radius, 10px);
        font-weight: 600;
        cursor: pointer;
        text-transform: uppercase;
        font-size: 0.85rem;
        letter-spacing: 0.5px;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        background: rgba(var(--foreground-rgb, 255, 255, 255), 0.08);
        color: var(--foreground, #fff);
        transition:
          background var(--animation-duration-fast, 0.2s)
            var(--animation-easing, ease),
          transform var(--animation-duration-fast, 0.2s)
            var(--animation-easing, ease),
          box-shadow var(--animation-duration-fast, 0.2s)
            var(--animation-easing, ease);
      }

      .subscribe-button:hover:not(:disabled) {
        background: rgba(var(--foreground-rgb, 255, 255, 255), 0.15);
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      }

      .subscribe-button.subscribed {
        background: var(--accent, #6366f1);
        color: var(--background, #000);
        border-color: transparent;
        font-weight: 700;
      }

      .subscribe-button.subscribed:hover:not(:disabled) {
        box-shadow: 0 0 20px rgba(var(--accent-rgb, 100, 100, 255), 0.3);
      }

      .subscribe-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }
    `,
  ],
})
export class ChannelHeaderComponent implements OnInit, OnDestroy {
  private themeService = inject(ThemeService);
  private themeSub?: Subscription;

  @Input() channel!: ChannelDto;
  @Input() isSubscribed = false;
  @Input() subscribing = false;

  @Output() subscribe = new EventEmitter<string>();
  @Output() unsubscribe = new EventEmitter<string>();

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

  onSubscribeClick() {
    if (this.isSubscribed) {
      this.unsubscribe.emit(this.channel.id);
    } else {
      this.subscribe.emit(this.channel.id);
    }
  }
}
