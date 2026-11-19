import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { longDate } from '@optimistic-tanuki/civic-briefing-ui';
import { CityBriefingComponent } from '../../components/city-briefing/city-briefing.component';
import { DaylightCommunityComponent } from '../../components/daylight-community/daylight-community.component';
import { City, CommunityService } from '../../services/community.service';
import {
  TownSourcesService,
  type TownSourceStatus,
} from '../../services/town-sources.service';
import { TownSourcesNoteComponent } from './town-sources-note.component';

/**
 * A town's briefing on its own page: `city/:slug/briefing` for the latest
 * edition, `city/:slug/briefing/:date` for one day (plan slice P4.3).
 */
@Component({
  selector: 'app-city-briefing-page',
  imports: [
    RouterLink,
    CityBriefingComponent,
    DaylightCommunityComponent,
    TownSourcesNoteComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './city-briefing-page.component.html',
  styleUrl: './city-briefing-page.component.scss',
})
export class CityBriefingPageComponent {
  private readonly communities = inject(CommunityService);
  private readonly townSources = inject(TownSourcesService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap, {
    requireSync: true,
  });

  protected readonly slug = computed(() => this.params().get('slug') ?? '');
  protected readonly date = computed(() => this.params().get('date'));
  protected readonly city = signal<City | null>(null);
  protected readonly loading = signal(true);
  private readonly sourceStatus = signal<TownSourceStatus | null>(null);
  private readonly noBriefing = signal(false);
  /** False until the source-status call settles, so the feed's own "no briefing" notice doesn't flash before the note replaces it. */
  private readonly statusSettled = signal(false);
  protected readonly holdAbsentNotice = computed(
    () => this.noBriefing() && !this.date() && !this.statusSettled()
  );
  /** Set when the town has no sources and no briefing to show (D32). */
  protected readonly sourcesNote = computed(() => {
    const status = this.sourceStatus()?.status;
    return this.noBriefing() &&
      !this.date() &&
      (status === 'no-sources' || status === 'not-sourced-yet')
      ? status
      : null;
  });

  constructor() {
    void this.load();
  }

  protected showNote(): void {
    this.noBriefing.set(true);
  }

  /** A failed or unknown status leaves the page as it was. */
  private async loadSourceStatus(localitySlug: string): Promise<void> {
    try {
      this.sourceStatus.set(await this.townSources.status(localitySlug));
    } catch {
      this.sourceStatus.set(null);
    } finally {
      this.statusSettled.set(true);
    }
  }

  private async load(): Promise<void> {
    const city = (await this.communities.getCityBySlug(this.slug())) ?? null;
    this.city.set(city);
    this.loading.set(false);
    if (!city) return;
    if (city.localitySlug) void this.loadSourceStatus(city.localitySlug);
    else this.statusSettled.set(true);
    const date = this.date();
    const heading = date
      ? `Daylight: ${city.name}, ${longDate(date)}`
      : `Daylight: ${city.name}`;
    this.title.setTitle(`${heading} - Towne Square`);
    this.meta.updateTag({
      name: 'description',
      content: `What ${city.name}'s public records and local news said, day by day.`,
    });
  }
}
