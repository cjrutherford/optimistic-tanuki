import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { VideoService } from '../../services/video.service';
import { VideoDto } from '@optimistic-tanuki/ui-models';
import { RadiusScope } from '@optimistic-tanuki/ui-models';
import {
  LocalityDiscoveryResultDto,
  NearbyBusinessDiscoveryDto,
  NearbyChannelDiscoveryDto,
} from '@optimistic-tanuki/models';
import { VideoGridComponent } from '@optimistic-tanuki/video-ui';
import { AuroraRibbonComponent } from '@optimistic-tanuki/motion-ui';
import { LocalityDiscoveryService } from '../../services/locality-discovery.service';
import {
  OnPageCampaign,
  SponsorDiscoveryService,
} from '../../services/sponsor-discovery.service';
import { AppRegistryService } from '@optimistic-tanuki/app-registry';
import {
  buildVideoLocalityLabel,
  formatVideoDistance,
  resolveVideoRadiusScope,
} from '../../locality/video-locality.utils';

@Component({
  selector: 'video-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    VideoGridComponent,
    AuroraRibbonComponent,
  ],
  template: `
    <div class="home-page">
      <section class="hero">
        <div class="hero-background">
          <otui-aurora-ribbon
            height="400px"
            [density]="8"
            [speed]="0.4"
            [intensity]="0.6"
          ></otui-aurora-ribbon>
        </div>
        <div class="hero-content">
          <h1 class="hero-title">Discover & Stream</h1>
          <p class="hero-subtitle">
            Tune into nearby channels, catch what's airing around you, and jump
            into the broader stream when you want more.
          </p>
          <div class="hero-actions">
            <a class="hero-link" routerLink="/browse/local">Open local tuner</a>
          </div>
          <div class="hero-locality" *ngIf="localityLabel">
            <span class="hero-chip">Tuned to {{ localityLabel }}</span>
            <span class="hero-chip muted" *ngIf="localityMeta">
              {{ localityMeta }}
            </span>
          </div>
        </div>
      </section>

      <section class="local-scene" *ngIf="localityDiscovery">
        <div class="section-heading">
          <h2>Local Scene</h2>
          <p>
            Nearby channels, communities, and businesses sharing your current
            radius.
          </p>
        </div>
        <div class="scene-metrics">
          <article class="scene-metric">
            <span class="metric-value">{{
              localityDiscovery.channels.length
            }}</span>
            <span class="metric-label">Nearby channels</span>
          </article>
          <article class="scene-metric">
            <span class="metric-value">{{
              localityDiscovery.communities.length
            }}</span>
            <span class="metric-label">Nearby communities</span>
          </article>
          <article class="scene-metric">
            <span class="metric-value">{{
              localityDiscovery.businesses.length
            }}</span>
            <span class="metric-label">Nearby businesses</span>
          </article>
        </div>
      </section>

      <section class="video-section" *ngIf="nearbyChannels.length > 0">
        <div class="section-heading">
          <h2>Nearby Channels</h2>
          <p>Channels anchored closest to your current locality.</p>
        </div>
        <div class="nearby-grid">
          <article class="nearby-card" *ngFor="let channel of nearbyChannels">
            <div class="nearby-card-copy">
              <p class="nearby-kicker">
                {{ formatDistance(channel.distanceMeters) }}
                <span *ngIf="channel.communitySlug">
                  • {{ channel.communitySlug }}</span
                >
              </p>
              <h3>{{ channel.name }}</h3>
              <p>
                {{
                  channel.description ||
                    'Local programming, replays, and live moments from your radius.'
                }}
              </p>
            </div>
            <a
              class="nearby-link"
              [routerLink]="['/c', channel.communitySlug || channel.id]"
            >
              Open channel
            </a>
          </article>
        </div>
      </section>

      <section class="video-section" *ngIf="nearbyBusinesses.length > 0">
        <div class="section-heading">
          <h2>Nearby Businesses</h2>
          <p>Local businesses with a hosted Studio presence in your radius.</p>
        </div>
        <div class="nearby-grid">
          <article
            class="nearby-card"
            *ngFor="let business of nearbyBusinesses"
          >
            <div class="nearby-card-copy">
              <p class="nearby-kicker">
                {{ formatDistance(business.distanceMeters) }}
                <span *ngIf="business.communitySlug">
                  • {{ business.communitySlug }}
                </span>
              </p>
              <h3>{{ business.name }}</h3>
              <p>
                {{
                  business.description ||
                    business.address ||
                    'A nearby business with an active public presence.'
                }}
              </p>
            </div>
            <a
              *ngIf="getBusinessHref(business) as href"
              class="nearby-link"
              [href]="href"
              data-testid="nearby-business-link"
            >
              Visit business
            </a>
          </article>
        </div>
      </section>

      <section class="video-section" *ngIf="nearbySponsors.length > 0">
        <div class="section-heading">
          <h2>Local Sponsors</h2>
          <p>Campaigns selected for your local programming.</p>
        </div>
        <div class="nearby-grid">
          <article
            class="nearby-card sponsor-card"
            *ngFor="let sponsor of nearbySponsors"
          >
            <div class="nearby-card-copy">
              <p class="nearby-kicker">Sponsored</p>
              <h3>{{ sponsor.creative.headline || sponsor.name }}</h3>
              <p>
                {{
                  sponsor.creative.body ||
                    'A local business supporting programming.'
                }}
              </p>
            </div>
            <a
              *ngIf="getSponsorHref(sponsor) as href"
              class="nearby-link"
              [href]="href"
              data-testid="local-sponsor-link"
            >
              {{ sponsor.creative.ctaLabel || 'Visit sponsor' }}
            </a>
          </article>
        </div>
      </section>

      <section class="video-section">
        <h2>Recommended Videos</h2>
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
        <div class="shimmer-loader">
          <div class="shimmer-bar"></div>
          <div class="shimmer-bar short"></div>
        </div>
      </div>

      <div *ngIf="error" class="error">
        <p>{{ error }}</p>
      </div>
    </div>
  `,
  styles: [
    `
      .home-page {
        max-width: 1400px;
        margin: 0 auto;
        padding: 0 1rem 2rem;
      }

      .hero {
        position: relative;
        min-height: 360px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 3rem;
        overflow: hidden;
        border-radius: var(--personality-border-radius, 16px);
      }

      .hero-background {
        position: absolute;
        inset: 0;
        z-index: 0;
        opacity: 0.5;
      }

      .hero-content {
        position: relative;
        z-index: 1;
        text-align: center;
        padding: 3rem 2rem;
      }

      .hero-title {
        font-family: var(--font-heading, system-ui);
        font-size: clamp(2.5rem, 5vw, 4rem);
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--foreground);
        margin: 0 0 1rem;
      }

      .hero-subtitle {
        font-size: 1.125rem;
        color: rgba(var(--foreground-rgb, 232, 232, 236), 0.7);
        max-width: 540px;
        margin: 0 auto;
        line-height: 1.6;
      }

      .hero-locality {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.75rem;
        margin-top: 1.5rem;
      }

      .hero-actions {
        margin-top: 1.5rem;
      }

      .hero-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.85rem 1.15rem;
        border-radius: 999px;
        background: rgba(var(--foreground-rgb, 232, 232, 236), 0.92);
        color: #07111f;
        font-weight: 700;
        text-decoration: none;
      }

      .hero-chip {
        border: 1px solid rgba(var(--foreground-rgb, 232, 232, 236), 0.18);
        background: rgba(10, 16, 28, 0.38);
        color: var(--foreground);
        border-radius: 999px;
        padding: 0.65rem 1rem;
        font-size: 0.9rem;
        backdrop-filter: blur(10px);
      }

      .hero-chip.muted {
        color: rgba(var(--foreground-rgb, 232, 232, 236), 0.72);
      }

      .video-section {
        margin-bottom: 3rem;
      }

      .video-section h2,
      .section-heading h2 {
        font-family: var(--font-heading, system-ui);
        font-size: 1.5rem;
        font-weight: 700;
        margin-bottom: 1.5rem;
        padding-left: 1rem;
        border-left: 3px solid var(--accent, #6366f1);
        color: var(--foreground);
      }

      .section-heading {
        margin-bottom: 1.5rem;
      }

      .section-heading p {
        margin: 0;
        color: rgba(var(--foreground-rgb, 232, 232, 236), 0.7);
      }

      .local-scene {
        margin-bottom: 3rem;
        border: 1px solid rgba(var(--foreground-rgb, 232, 232, 236), 0.1);
        border-radius: 24px;
        padding: 1.5rem;
        background: linear-gradient(
            145deg,
            rgba(14, 23, 40, 0.82),
            rgba(7, 13, 24, 0.92)
          ),
          var(--surface, #0b1020);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.2);
      }

      .scene-metrics {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 1rem;
      }

      .scene-metric {
        border-radius: 18px;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(var(--foreground-rgb, 232, 232, 236), 0.08);
      }

      .metric-value {
        display: block;
        font-size: 1.8rem;
        font-weight: 700;
        color: var(--foreground);
      }

      .metric-label {
        display: block;
        margin-top: 0.35rem;
        color: rgba(var(--foreground-rgb, 232, 232, 236), 0.68);
      }

      .nearby-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 1rem;
      }

      .nearby-card {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 220px;
        padding: 1.25rem;
        border-radius: 20px;
        background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.05),
            rgba(255, 255, 255, 0.02)
          ),
          rgba(8, 12, 22, 0.92);
        border: 1px solid rgba(var(--foreground-rgb, 232, 232, 236), 0.08);
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.16);
      }

      .nearby-kicker {
        margin: 0 0 0.65rem;
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(var(--foreground-rgb, 232, 232, 236), 0.58);
      }

      .nearby-card h3 {
        margin: 0 0 0.75rem;
        font-size: 1.2rem;
        color: var(--foreground);
      }

      .nearby-card p {
        margin: 0;
        line-height: 1.6;
        color: rgba(var(--foreground-rgb, 232, 232, 236), 0.74);
      }

      .nearby-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: fit-content;
        margin-top: 1.25rem;
        padding: 0.75rem 1rem;
        border-radius: 999px;
        background: var(--accent, #6366f1);
        color: #07111f;
        font-weight: 700;
        text-decoration: none;
      }

      @media (max-width: 720px) {
        .local-scene {
          padding: 1.25rem;
        }
      }

      .loading {
        text-align: center;
        padding: 3rem;
      }

      .shimmer-loader {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
      }

      .shimmer-bar {
        width: 200px;
        height: 12px;
        border-radius: 6px;
        background: linear-gradient(
          90deg,
          rgba(var(--foreground-rgb, 232, 232, 236), 0.06) 0%,
          rgba(var(--foreground-rgb, 232, 232, 236), 0.15) 50%,
          rgba(var(--foreground-rgb, 232, 232, 236), 0.06) 100%
        );
        background-size: 200% 100%;
        animation: shimmer 1.5s ease-in-out infinite;
      }

      .shimmer-bar.short {
        width: 140px;
      }

      @keyframes shimmer {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }

      .error {
        text-align: center;
        padding: 3rem;
        font-size: 1.125rem;
        color: var(--danger, #ef4444);
      }
    `,
  ],
})
export class HomeComponent implements OnInit {
  recommendedVideos: VideoDto[] = [];
  trendingVideos: VideoDto[] = [];
  nearbyChannels: NearbyChannelDiscoveryDto[] = [];
  nearbyBusinesses: NearbyBusinessDiscoveryDto[] = [];
  nearbySponsors: OnPageCampaign[] = [];
  localityDiscovery: LocalityDiscoveryResultDto | null = null;
  localityLabel = '';
  localityMeta = '';
  loading = false;
  error: string | null = null;
  private businessSiteBaseUrl: string | null = null;

  constructor(
    private readonly videoService: VideoService,
    private readonly localityDiscoveryService: LocalityDiscoveryService,
    private readonly appRegistry: AppRegistryService,
    private readonly sponsorDiscoveryService: SponsorDiscoveryService
  ) {}

  ngOnInit() {
    this.loadVideos();
    void this.loadLocalityScene();
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

  async loadLocalityScene(): Promise<void> {
    const scope = await this.resolveRadiusScope();
    const businessSiteApp = await firstValueFrom(
      this.appRegistry.getApp('business-site')
    );
    this.businessSiteBaseUrl = businessSiteApp?.uiBaseUrl ?? null;
    this.localityDiscoveryService
      .discoverNearby(scope, { scope: 'local-hub', limit: 6 })
      .subscribe({
        next: (result) => {
          this.localityDiscovery = result;
          this.nearbyChannels = result.channels.slice(0, 6);
          this.nearbyBusinesses = result.businesses
            .filter((business) => !!this.getBusinessHref(business))
            .slice(0, 6);
          const communityId = result.communities[0]?.id;
          if (communityId) {
            this.sponsorDiscoveryService
              .discoverOnPage({ communityId })
              .subscribe({
                next: (campaigns) => {
                  this.nearbySponsors = campaigns.slice(0, 6);
                },
                error: (err) => {
                  console.error('Error loading local campaigns:', err);
                },
              });
          } else {
            this.nearbySponsors = [];
          }
          this.localityLabel = buildVideoLocalityLabel(
            result.locality,
            result.anchor
          );
          this.localityMeta = [
            this.formatDistance(result.radiusMeters),
            result.locality.timezone,
          ]
            .filter(Boolean)
            .join(' radius • ');
        },
        error: (err) => {
          this.localityLabel = buildVideoLocalityLabel(null, scope.anchor);
          this.localityMeta = `${this.formatDistance(
            scope.radiusMeters
          )} radius`;
          console.error('Error loading local scene:', err);
        },
      });
  }

  getBusinessHref(business: NearbyBusinessDiscoveryDto): string | null {
    if (!this.businessSiteBaseUrl || !business.sitePath) {
      return null;
    }

    return `${this.businessSiteBaseUrl}${business.sitePath}`;
  }

  getSponsorHref(sponsor: OnPageCampaign): string | null {
    const business = this.nearbyBusinesses.find(
      (candidate) => candidate.id === sponsor.businessPageId
    );

    return (
      (business && this.getBusinessHref(business)) ||
      sponsor.creative.ctaUrl ||
      null
    );
  }

  async resolveRadiusScope(): Promise<RadiusScope> {
    return resolveVideoRadiusScope();
  }

  formatDistance(distanceMeters: number): string {
    return formatVideoDistance(distanceMeters);
  }

  navigateToVideo(video: VideoDto) {
    // Navigation will be handled by router in the template
    window.location.href = `/watch/${video.id}`;
  }
}
