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

/**
 * A town's briefing on its own page: `city/:slug/briefing` for the latest
 * edition, `city/:slug/briefing/:date` for one day (plan slice P4.3).
 */
@Component({
  selector: 'app-city-briefing-page',
  imports: [RouterLink, CityBriefingComponent, DaylightCommunityComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './city-briefing-page.component.html',
  styleUrl: './city-briefing-page.component.scss',
})
export class CityBriefingPageComponent {
  private readonly communities = inject(CommunityService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap, {
    requireSync: true,
  });

  protected readonly slug = computed(() => this.params().get('slug') ?? '');
  protected readonly date = computed(() => this.params().get('date'));
  protected readonly city = signal<City | null>(null);
  protected readonly loading = signal(true);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const city = (await this.communities.getCityBySlug(this.slug())) ?? null;
    this.city.set(city);
    this.loading.set(false);
    if (!city) return;
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
