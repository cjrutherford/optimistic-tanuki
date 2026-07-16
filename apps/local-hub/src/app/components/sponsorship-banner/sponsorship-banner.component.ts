import { Component, Input, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  PaymentService,
  OnPageAdvertisingCampaign,
} from '../../services/payment.service';

@Component({
  selector: 'app-sponsorship-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (loading()) {
    <div class="sponsorship-skeleton"></div>
    } @else if (campaigns().length > 0) {
    <div
      class="sponsorship-banner"
      [class.banner]="type === 'banner'"
      [class.sticky]="type === 'sticky'"
      [class.featured]="type === 'featured'"
    >
      @for (sponsor of campaigns(); track sponsor.id) {
      <div class="sponsor-item">
        @if ( sponsor.creative.body || sponsor.creative.headline ||
        sponsor.creative.mediaUrl || sponsor.creative.imageUrl ||
        sponsor.creative.ctaUrl || sponsor.creative.businessSiteUrl ) {
        <div class="sponsor-content">
          <span class="sponsored-label">Sponsored</span>
          <p class="ad-text">
            {{ sponsor.creative.headline || sponsor.name
            }}{{ sponsor.creative.body ? ' — ' + sponsor.creative.body : '' }}
          </p>
          @if (sponsor.creative.mediaUrl || sponsor.creative.imageUrl) {
          <img
            [src]="sponsor.creative.mediaUrl || sponsor.creative.imageUrl"
            alt="Sponsored content"
            class="ad-image"
          />
          } @if (sponsor.creative.ctaUrl || sponsor.creative.businessSiteUrl) {
          <a
            class="ad-cta"
            [href]="sponsor.creative.ctaUrl || sponsor.creative.businessSiteUrl"
            target="_blank"
            rel="noopener noreferrer"
            >{{ sponsor.creative.ctaLabel || 'Learn more' }}</a
          >
          }
        </div>
        }
      </div>
      }
    </div>
    }
  `,
  styles: [
    `
      .sponsorship-skeleton {
        height: 60px;
        background: color-mix(in srgb, var(--surface) 82%, var(--background));
        border-radius: 8px;
        animation: pulse 1.5s infinite;
      }

      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }

      .sponsorship-banner {
        border-radius: 8px;
        overflow: hidden;
        margin-bottom: 1rem;
      }

      .sponsorship-banner.banner {
        background: linear-gradient(
          135deg,
          color-mix(in srgb, var(--primary) 88%, var(--background)) 0%,
          color-mix(in srgb, var(--secondary) 76%, var(--background)) 100%
        );
        padding: 1rem;
      }

      .sponsorship-banner.sticky {
        position: sticky;
        top: 0;
        background: var(--surface);
        border: 1px solid var(--border);
        padding: 0.75rem;
        z-index: 100;
      }

      .sponsorship-banner.featured {
        background: linear-gradient(
          135deg,
          color-mix(
              in srgb,
              var(--accent, var(--primary)) 78%,
              var(--background)
            )
            0%,
          color-mix(in srgb, var(--secondary) 72%, var(--background)) 100%
        );
        padding: 1rem;
      }

      .sponsor-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .sponsored-label {
        font-size: 0.625rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        opacity: 0.8;
        color: white;
      }

      .sponsor-content {
        flex: 1;
      }

      .ad-text {
        margin: 0.25rem 0 0;
        color: white;
        font-size: 0.875rem;
      }

      .ad-image {
        max-height: 80px;
        max-width: 100%;
        margin-top: 0.5rem;
        border-radius: 4px;
      }

      .featured-badge {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        background: rgba(255, 255, 255, 0.2);
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        color: white;
        font-size: 0.75rem;
        font-weight: 500;
      }
    `,
  ],
})
export class SponsorshipBannerComponent implements OnInit {
  @Input() communityId = '';
  @Input() type: 'banner' | 'sticky' | 'featured' = 'banner';

  private paymentService = inject(PaymentService);

  campaigns = signal<OnPageAdvertisingCampaign[]>([]);
  loading = signal(true);

  async ngOnInit(): Promise<void> {
    if (!this.communityId) return;

    try {
      const campaigns = await this.paymentService.getEligibleOnPageCampaigns(
        this.communityId
      );
      this.campaigns.set(campaigns);
    } catch (err) {
      console.error('Failed to load sponsorships:', err);
    } finally {
      this.loading.set(false);
    }
  }
}
