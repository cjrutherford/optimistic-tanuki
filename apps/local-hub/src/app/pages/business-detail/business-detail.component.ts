import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  DirectoryDetailComponent,
  DirectoryDetailStatus,
  LocalDirectoryCoverage,
  LocalDirectoryListing,
  LocalDirectorySourceFreshness,
} from '@optimistic-tanuki/directory-ui';
import { City, CommunityService } from '../../services/community.service';
import { DirectoryService } from '../../services/directory.service';

interface DirectoryMeta {
  freshness: LocalDirectorySourceFreshness | null;
  coverage: LocalDirectoryCoverage | null;
}

/** One listing in a town's directory, reached from the list by its short-lived reference. */
@Component({
  selector: 'app-business-detail',
  standalone: true,
  imports: [DirectoryDetailComponent],
  template: `
    <main class="detail-page" aria-label="Business listing">
      <otd-directory-detail
        [status]="status()"
        [listing]="listing()"
        [freshness]="meta()?.freshness ?? null"
        [coverage]="meta()?.coverage ?? null"
        [backLink]="backLink()"
        [backLabel]="backLabel()"
        [reportLink]="reportLink()"
      ></otd-directory-detail>
    </main>
  `,
  styles: [
    `
      .detail-page {
        max-width: 48rem;
        margin: 0 auto;
        padding: 2rem 1.5rem 5rem;
        color: var(--foreground);
        background: var(--background);
      }
    `,
  ],
})
export class BusinessDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private title = inject(Title);
  private platformId = inject(PLATFORM_ID);
  private communityService = inject(CommunityService);
  private directoryService = inject(DirectoryService);
  private destroy$ = new Subject<void>();
  private generation = 0;
  /** Freshness and coverage handed over by the list, so a detail view needs no second round trip. */
  private handedOver: DirectoryMeta | null =
    (this.router.getCurrentNavigation()?.extras.state?.['directoryMeta'] as
      | DirectoryMeta
      | undefined) ?? null;

  city = signal<City | null>(null);
  status = signal<DirectoryDetailStatus>('loading');
  listing = signal<LocalDirectoryListing | null>(null);
  meta = signal<DirectoryMeta | null>(null);
  backLink = signal<unknown[] | null>(null);
  backLabel = signal('Back to the directory');
  reportLink = signal<unknown[] | null>(null);

  ngOnInit(): void {
    if (!this.handedOver && isPlatformBrowser(this.platformId)) {
      const state = (history.state ?? null) as {
        directoryMeta?: DirectoryMeta;
      } | null;
      this.handedOver = state?.directoryMeta ?? null;
    }
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([params, query]) =>
        this.load(
          params.get('slug') ?? '',
          params.get('reference') ?? '',
          query.get('adult') === '1'
        )
      );
  }

  ngOnDestroy(): void {
    this.generation++;
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async load(
    slug: string,
    reference: string,
    adult: boolean
  ): Promise<void> {
    const generation = ++this.generation;
    this.status.set('loading');
    const city = await this.communityService.getCityBySlug(slug);
    if (generation !== this.generation) return;
    if (!city) {
      this.status.set('failed');
      return;
    }
    this.city.set(city);
    this.backLink.set(['/city', city.slug, 'businesses']);
    this.backLabel.set(`Back to the ${city.name} directory`);
    this.reportLink.set([
      '/city',
      city.slug,
      'businesses',
      reference,
      'report',
    ]);
    try {
      const listing = await this.directoryService.getListing(
        city.id,
        reference,
        adult
      );
      if (generation !== this.generation) return;
      if (!listing) {
        this.status.set('expired');
        this.title.setTitle(`Listing expired - ${city.name} - Towne Square`);
        return;
      }
      this.listing.set(listing);
      this.title.setTitle(`${listing.name} - ${city.name} - Towne Square`);
      this.meta.set(this.handedOver);
      this.status.set('ready');
      if (!this.handedOver) void this.loadMeta(city.id, generation);
    } catch {
      if (generation === this.generation) this.status.set('failed');
    }
  }

  /** A direct link carries no freshness or coverage; read them from the first page, ignoring its listings. */
  private async loadMeta(townId: string, generation: number): Promise<void> {
    try {
      const page = await this.directoryService.getPage(townId, {
        q: '',
        category: '',
        adult: false,
        cursor: '',
      });
      if (generation === this.generation) {
        this.meta.set({
          freshness: page.sourceFreshness,
          coverage: page.coverage,
        });
      }
    } catch {
      // The generic limitation text still applies; freshness is simply not shown.
    }
  }
}
