import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Params, RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NearbyChannelDiscoveryDto } from '@optimistic-tanuki/models';
import { ChannelFeedDto, ProgramBlockDto } from '@optimistic-tanuki/ui-models';
import {
  buildVideoLocalityLabel,
  formatVideoDistance,
  resolveVideoRadiusScope,
} from '../../locality/video-locality.utils';
import { LocalityDiscoveryService } from '../../services/locality-discovery.service';
import { VideoService } from '../../services/video.service';

type BrowseEntry = {
  channel: NearbyChannelDiscoveryDto;
  feed: ChannelFeedDto | null;
  schedule: ProgramBlockDto[];
  currentBlock: ProgramBlockDto | null;
  upcomingBlock: ProgramBlockDto | null;
};

type ProgramCard = {
  channel: NearbyChannelDiscoveryDto;
  block: ProgramBlockDto | null;
  mode: 'live' | 'scheduled' | 'replay' | 'upcoming';
  route: string[];
  queryParams: Params;
};

@Component({
  selector: 'video-local-browse',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="browse-page">
      <header class="browse-hero">
        <p class="eyebrow">Local Tuner</p>
        <h1>Browse what your radius is airing.</h1>
        <p class="hero-copy">
          Scan nearby channels, jump into live programming, and line up what is
          coming next without leaving your local dial.
        </p>
        <div class="hero-meta" *ngIf="localityLabel">
          <span class="hero-chip">Tuned to {{ localityLabel }}</span>
          <span class="hero-chip muted" *ngIf="localityMeta">
            {{ localityMeta }}
          </span>
        </div>
      </header>

      <section class="browse-section" *ngIf="onNowPrograms.length > 0">
        <div class="section-heading">
          <h2>On Now</h2>
          <p>Live channels and active scheduled blocks in your local radius.</p>
        </div>
        <div class="program-grid">
          <article class="program-card" *ngFor="let program of onNowPrograms">
            <p class="kicker">
              {{
                program.mode === 'live'
                  ? 'Live now'
                  : program.mode === 'replay'
                  ? 'Replay now'
                  : 'Airing now'
              }}
              •
              {{ formatDistance(program.channel.distanceMeters) }}
            </p>
            <h3>{{ program.block?.title || program.channel.name }}</h3>
            <p class="channel-name">{{ program.channel.name }}</p>
            <p>
              {{
                program.block?.description ||
                  program.channel.description ||
                  'Programming from a nearby anchored channel.'
              }}
            </p>
            <p class="timing" *ngIf="program.block">
              {{ program.block.startsAt | date : 'shortTime' }} -
              {{ program.block.endsAt | date : 'shortTime' }}
            </p>
            <a
              class="program-link"
              [routerLink]="program.route"
              [queryParams]="program.queryParams"
            >
              {{
                program.mode === 'live'
                  ? 'Watch live'
                  : program.mode === 'replay'
                  ? 'Open feed'
                  : 'Open schedule'
              }}
            </a>
          </article>
        </div>
      </section>

      <section class="browse-section" *ngIf="upcomingPrograms.length > 0">
        <div class="section-heading">
          <h2>Upcoming</h2>
          <p>The next scheduled blocks across nearby channels.</p>
        </div>
        <div class="program-grid">
          <article
            class="program-card upcoming"
            *ngFor="let program of upcomingPrograms"
          >
            <p class="kicker">
              Up next • {{ formatDistance(program.channel.distanceMeters) }}
            </p>
            <h3>{{ program.block?.title }}</h3>
            <p class="channel-name">{{ program.channel.name }}</p>
            <p>
              {{
                program.block?.description ||
                  program.channel.description ||
                  'Scheduled local programming.'
              }}
            </p>
            <p class="timing" *ngIf="program.block">
              {{ program.block.startsAt | date : 'medium' }}
            </p>
            <a
              class="program-link"
              [routerLink]="program.route"
              [queryParams]="program.queryParams"
            >
              View scheduled block
            </a>
          </article>
        </div>
      </section>

      <section class="browse-section" *ngIf="nearbyChannels.length > 0">
        <div class="section-heading">
          <h2>Local Channels</h2>
          <p>Browse the wider local rail beyond the home page highlights.</p>
        </div>
        <div class="channel-rail">
          <a
            class="channel-pill"
            *ngFor="let channel of nearbyChannels"
            [routerLink]="['/c', channel.communitySlug || channel.id]"
          >
            <span class="pill-name">{{ channel.name }}</span>
            <span class="pill-meta">
              {{ formatDistance(channel.distanceMeters) }}
              <span *ngIf="channel.communitySlug">
                • {{ channel.communitySlug }}
              </span>
            </span>
          </a>
        </div>
      </section>

      <div class="empty-state" *ngIf="!loading && nearbyChannels.length === 0">
        <p>No nearby channels were found for this radius yet.</p>
      </div>

      <div *ngIf="loading" class="loading">
        <p>Loading local lineup...</p>
      </div>

      <div *ngIf="error" class="error">
        <p>{{ error }}</p>
      </div>
    </div>
  `,
  styles: [
    `
      .browse-page {
        max-width: 1400px;
        margin: 0 auto;
        padding: 0 1rem 3rem;
      }

      .browse-hero,
      .browse-section {
        margin-bottom: 2.5rem;
      }

      .browse-hero {
        padding: 2rem;
        border-radius: 28px;
        background: radial-gradient(
            circle at top left,
            rgba(72, 187, 120, 0.18),
            transparent 35%
          ),
          radial-gradient(
            circle at top right,
            rgba(56, 189, 248, 0.18),
            transparent 30%
          ),
          linear-gradient(180deg, rgba(11, 19, 33, 0.96), rgba(7, 12, 21, 0.98));
        border: 1px solid rgba(var(--foreground-rgb, 232, 232, 236), 0.08);
      }

      .eyebrow,
      .kicker {
        margin: 0 0 0.75rem;
        font-size: 0.78rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: rgba(var(--foreground-rgb, 232, 232, 236), 0.62);
      }

      h1,
      .section-heading h2 {
        font-family: var(--font-heading, system-ui);
        color: var(--foreground);
      }

      h1 {
        margin: 0 0 0.75rem;
        font-size: clamp(2.25rem, 5vw, 3.5rem);
      }

      .hero-copy,
      .section-heading p,
      .program-card p,
      .empty-state p {
        color: rgba(var(--foreground-rgb, 232, 232, 236), 0.74);
        line-height: 1.6;
      }

      .hero-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-top: 1.25rem;
      }

      .hero-chip {
        border: 1px solid rgba(var(--foreground-rgb, 232, 232, 236), 0.12);
        border-radius: 999px;
        padding: 0.65rem 1rem;
        background: rgba(255, 255, 255, 0.04);
        color: var(--foreground);
      }

      .hero-chip.muted {
        color: rgba(var(--foreground-rgb, 232, 232, 236), 0.72);
      }

      .section-heading {
        margin-bottom: 1.25rem;
      }

      .section-heading h2 {
        margin: 0 0 0.5rem;
        font-size: 1.5rem;
        padding-left: 1rem;
        border-left: 3px solid var(--accent, #6366f1);
      }

      .program-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 1rem;
      }

      .program-card {
        padding: 1.25rem;
        border-radius: 22px;
        background: linear-gradient(
          180deg,
          rgba(17, 24, 39, 0.92),
          rgba(7, 12, 21, 0.98)
        );
        border: 1px solid rgba(var(--foreground-rgb, 232, 232, 236), 0.08);
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.16);
      }

      .program-card.upcoming {
        background: linear-gradient(
          180deg,
          rgba(16, 30, 44, 0.92),
          rgba(9, 16, 28, 0.98)
        );
      }

      .program-card h3 {
        margin: 0 0 0.35rem;
        color: var(--foreground);
      }

      .channel-name,
      .timing {
        font-size: 0.92rem;
      }

      .channel-name {
        color: rgba(var(--foreground-rgb, 232, 232, 236), 0.88);
      }

      .program-link {
        display: inline-flex;
        margin-top: 1rem;
        text-decoration: none;
        font-weight: 700;
        color: #07111f;
        background: var(--accent, #6366f1);
        border-radius: 999px;
        padding: 0.75rem 1rem;
      }

      .channel-rail {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      .channel-pill {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        min-width: 220px;
        padding: 1rem 1.1rem;
        border-radius: 18px;
        text-decoration: none;
        color: var(--foreground);
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(var(--foreground-rgb, 232, 232, 236), 0.08);
      }

      .pill-name {
        font-weight: 700;
      }

      .pill-meta {
        font-size: 0.88rem;
        color: rgba(var(--foreground-rgb, 232, 232, 236), 0.62);
      }

      .loading,
      .error,
      .empty-state {
        text-align: center;
        padding: 2rem;
      }

      .error {
        color: var(--danger, #ef4444);
      }
    `,
  ],
})
export class LocalBrowseComponent implements OnInit {
  nearbyChannels: NearbyChannelDiscoveryDto[] = [];
  onNowPrograms: ProgramCard[] = [];
  upcomingPrograms: ProgramCard[] = [];
  localityLabel = '';
  localityMeta = '';
  loading = false;
  error: string | null = null;

  constructor(
    private readonly localityDiscoveryService: LocalityDiscoveryService,
    private readonly videoService: VideoService
  ) {}

  ngOnInit(): void {
    void this.loadBrowseScene();
  }

  async loadBrowseScene(): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      const scope = await resolveVideoRadiusScope();
      const discovery = await firstValueFrom(
        this.localityDiscoveryService.discoverNearby(scope, {
          scope: 'local-hub',
          limit: 12,
        })
      );

      this.nearbyChannels = discovery.channels.slice(0, 12);
      this.localityLabel = buildVideoLocalityLabel(
        discovery.locality,
        discovery.anchor
      );
      this.localityMeta = [
        formatVideoDistance(discovery.radiusMeters),
        discovery.locality.timezone,
      ]
        .filter(Boolean)
        .join(' radius • ');

      const entries = await this.loadBrowseEntries(this.nearbyChannels);
      this.onNowPrograms = entries
        .filter(
          (entry) => entry.feed?.currentMode === 'live' || !!entry.currentBlock
        )
        .map((entry) => this.toCurrentProgramCard(entry));
      this.upcomingPrograms = entries
        .filter(
          (entry): entry is BrowseEntry & { upcomingBlock: ProgramBlockDto } =>
            !!entry.upcomingBlock
        )
        .sort(
          (left, right) =>
            this.toTime(left.upcomingBlock.startsAt) -
            this.toTime(right.upcomingBlock.startsAt)
        )
        .map((entry) => this.toUpcomingProgramCard(entry));
    } catch (error) {
      this.error = 'Failed to load the local tuner';
      console.error('Error loading local browse scene:', error);
    } finally {
      this.loading = false;
    }
  }

  formatDistance(distanceMeters: number): string {
    return formatVideoDistance(distanceMeters);
  }

  private async loadBrowseEntries(
    channels: NearbyChannelDiscoveryDto[]
  ): Promise<BrowseEntry[]> {
    if (channels.length === 0) {
      return [];
    }

    const results = await firstValueFrom(
      forkJoin(
        channels.map((channel) => {
          const slugOrId = channel.communitySlug || channel.id;
          return forkJoin({
            channel: of(channel),
            feed: this.videoService.getChannelFeed(slugOrId).pipe(
              catchError((error) => {
                console.error('Error loading channel feed:', error);
                return of(null);
              })
            ),
            schedule: this.videoService.getChannelSchedule(slugOrId).pipe(
              catchError((error) => {
                console.error('Error loading channel schedule:', error);
                return of([]);
              })
            ),
          });
        })
      )
    );

    return results.map(({ channel, feed, schedule }) => ({
      channel,
      feed,
      schedule,
      currentBlock: this.findCurrentBlock(feed, schedule),
      upcomingBlock: this.findUpcomingBlock(feed, schedule),
    }));
  }

  private findCurrentBlock(
    feed: ChannelFeedDto | null,
    schedule: ProgramBlockDto[]
  ): ProgramBlockDto | null {
    if (feed?.activeProgramBlockId) {
      const matchingBlock =
        schedule.find((block) => block.id === feed.activeProgramBlockId) ||
        null;
      if (matchingBlock) {
        return matchingBlock;
      }
    }

    const now = Date.now();
    return (
      schedule.find((block) => {
        const start = this.toTime(block.actualStartAt ?? block.startsAt);
        const end = this.toTime(block.actualEndAt ?? block.endsAt);
        return (
          (block.status === 'live' || block.status === 'scheduled') &&
          start <= now &&
          end >= now
        );
      }) || null
    );
  }

  private findUpcomingBlock(
    feed: ChannelFeedDto | null,
    schedule: ProgramBlockDto[]
  ): ProgramBlockDto | null {
    const currentBlockId = this.findCurrentBlock(feed, schedule)?.id;
    const now = Date.now();
    const futureBlocks = schedule
      .filter(
        (block) =>
          block.id !== currentBlockId &&
          block.status === 'scheduled' &&
          this.toTime(block.startsAt) > now
      )
      .sort(
        (left, right) =>
          this.toTime(left.startsAt) - this.toTime(right.startsAt)
      );

    return futureBlocks[0] || null;
  }

  private toCurrentProgramCard(entry: BrowseEntry): ProgramCard {
    return {
      channel: entry.channel,
      block: entry.currentBlock,
      mode:
        entry.feed?.currentMode === 'live'
          ? 'live'
          : entry.feed?.currentMode === 'replay'
          ? 'replay'
          : 'scheduled',
      route: ['/c', entry.channel.communitySlug || entry.channel.id],
      queryParams:
        entry.feed?.currentMode === 'live'
          ? { tab: 'feed', mode: 'live' }
          : entry.feed?.currentMode === 'replay'
          ? {
              tab: 'feed',
              mode: 'replay',
              block: entry.currentBlock?.id,
            }
          : { tab: 'schedule', block: entry.currentBlock?.id },
    };
  }

  private toUpcomingProgramCard(
    entry: BrowseEntry & { upcomingBlock: ProgramBlockDto }
  ): ProgramCard {
    return {
      channel: entry.channel,
      block: entry.upcomingBlock,
      mode: 'upcoming',
      route: ['/c', entry.channel.communitySlug || entry.channel.id],
      queryParams: { tab: 'schedule', block: entry.upcomingBlock.id },
    };
  }

  private toTime(value: Date | string | null | undefined): number {
    return value ? new Date(value).getTime() : 0;
  }
}
