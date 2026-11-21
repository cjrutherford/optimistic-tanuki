import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ElementRef,
  PLATFORM_ID,
  viewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { combineLatest, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  City,
  CommunityService,
  DirectoryBoundary,
  LocalDirectoryListing,
} from '../../services/community.service';
import {
  DirectoryQuery,
  DirectoryRequestError,
  DirectoryService,
} from '../../services/directory.service';
import {
  DirectoryFilterBarComponent,
  DirectoryFilters,
  DirectoryListComponent,
  DirectoryNearbyTown,
  DirectoryStatePanelComponent,
  DirectoryStatus,
  DIRECTORY_LIMITATION_TEXT,
  DirectorySourceAttributionComponent,
  summarizeSources,
  DirectoryNearbyTownsComponent,
  LocalDirectoryCoverage,
  LocalDirectorySourceFreshness,
  nearestTowns,
} from '@optimistic-tanuki/directory-ui';
import { AuthStateService } from '../../services/auth-state.service';
import { MapComponent } from '../../components/map/map.component';
import { isRenderableCoordinate } from '../../components/map/map.utils';
import { TownLocatorComponent } from '../../components/town-locator/town-locator.component';
import {
  BadgeComponent,
  ButtonComponent,
  ErrorStateComponent,
  IconComponent,
  LoadingStateComponent,
} from '@optimistic-tanuki/common-ui';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';

interface BusinessPageLink {
  communityId: string;
  slug: string;
  name: string;
}

interface BusinessPageLinkRequest {
  requestId: string;
  businessCommunityId: string;
  status: 'pending' | 'approved';
}

interface BusinessPageLinkState {
  state:
    | 'loading'
    | 'linked'
    | 'unlinked'
    | 'requesting'
    | 'requested'
    | 'error';
  link?: BusinessPageLink;
  message?: string;
  requests?: BusinessPageLinkRequest[];
}

const NEARBY_LIMIT = 6;

/** Reads the directory filters and cursor out of the URL. Anything malformed is treated as absent. */
export function readDirectoryQuery(params: ParamMap): DirectoryQuery {
  const category = params.get('category') ?? '';
  return {
    q: (params.get('q') ?? '').trim().slice(0, 100),
    category:
      category.trim() &&
      category.length <= 2000 &&
      // eslint-disable-next-line no-control-regex -- Reject control characters in untrusted categories.
      !/[\x00-\x1f\x7f]/.test(category)
        ? category
        : '',
    adult: params.get('adult') === '1',
    cursor: params.get('cursor') ?? '',
  };
}

@Component({
  selector: 'app-business-directory',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MapComponent,
    BadgeComponent,
    ButtonComponent,
    ErrorStateComponent,
    IconComponent,
    LoadingStateComponent,
    TextInputComponent,
    TownLocatorComponent,
    DirectoryFilterBarComponent,
    DirectoryListComponent,
    DirectoryNearbyTownsComponent,
    DirectorySourceAttributionComponent,
    DirectoryStatePanelComponent,
  ],
  templateUrl: './business-directory.component.html',
  styleUrls: ['./business-directory.component.scss'],
})
export class BusinessDirectoryComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private communityService = inject(CommunityService);
  private directoryService = inject(DirectoryService);
  private authState = inject(AuthStateService);
  private title = inject(Title);
  private platformId = inject(PLATFORM_ID);
  private destroy$ = new Subject<void>();
  private boundaryGeneration = 0;
  private requestGeneration = 0;
  private slug = '';
  private appliedKey: string | null = null;
  private retryAction: (() => void) | null = null;
  private linkRequests = new Map<string, string>();
  private pageHeading = viewChild<ElementRef<HTMLElement>>('pageHeading');

  city = signal<City | null>(null);
  towns = signal<City[]>([]);
  directoryBoundary = signal<DirectoryBoundary>({ status: 'pending' });
  listings = signal<LocalDirectoryListing[]>([]);
  hasMore = signal(false);
  nextCursor = signal<string | null>(null);
  sourceFreshness = signal<LocalDirectorySourceFreshness | null>(null);
  coverage = signal<LocalDirectoryCoverage | null>(null);
  filters = signal<DirectoryFilters>({ q: '', category: '', adult: false });
  /** True when the URL carried a cursor we could not restore, so earlier results are not on this page. */
  startedMidway = signal(false);
  status = signal<DirectoryStatus>('loading');
  moreLoading = signal(false);
  loading = signal(true);
  isAuthenticated = signal(false);
  businessLinks = signal<Record<string, BusinessPageLinkState>>({});
  readonly limitation = DIRECTORY_LIMITATION_TEXT;

  filtersActive = computed(() => {
    const f = this.filters();
    return !!(f.q || f.category || f.adult);
  });
  categories = signal<string[]>([]);
  categoriesUnavailable = signal(false);
  nearbyTowns = computed<DirectoryNearbyTown[]>(() => {
    const city = this.city();
    return city
      ? nearestTowns(city.coordinates, this.towns(), {
          excludeSlug: city.slug,
          limit: NEARBY_LIMIT,
        })
      : [];
  });
  /** What the state panel should show: loading wins only while there is nothing to read yet. */
  panelStatus = computed<DirectoryStatus>(() => {
    const status = this.status();
    return status === 'loading' && this.listings().length > 0
      ? 'ready'
      : status;
  });

  /** One deduplicated credit list for every listing loaded so far. */
  sources = computed(() => summarizeSources(this.listings()));

  directoryMapLocations = computed(() =>
    this.listings().flatMap((listing) =>
      isRenderableCoordinate(listing.coordinates)
        ? [
            {
              name: listing.name,
              category: listing.category,
              coordinates: listing.coordinates,
              ...(this.city()?.slug && listing.reference
                ? {
                    href: `/city/${encodeURIComponent(
                      this.city()!.slug
                    )}/businesses/${encodeURIComponent(listing.reference)}${
                      this.filters().adult ? '?adult=1' : ''
                    }`,
                  }
                : {}),
            },
          ]
        : []
    )
  );
  mapCenter = computed(() => {
    const town = this.city()?.coordinates;
    return isRenderableCoordinate(town)
      ? town
      : this.directoryMapLocations()[0]?.coordinates ?? null;
  });
  detailState = computed(() => ({
    directoryMeta: {
      freshness: this.sourceFreshness(),
      coverage: this.coverage(),
    },
  }));
  detailQueryParams = computed(() =>
    this.filters().adult ? { adult: '1' } : undefined
  );

  detailLinkFor = (listing: LocalDirectoryListing): unknown[] | null => {
    const slug = this.city()?.slug;
    return slug && listing.reference
      ? ['/city', slug, 'businesses', listing.reference]
      : null;
  };
  businessPageFor = (listing: LocalDirectoryListing): boolean =>
    !!listing.id && this.businessLinks()[listing.id]?.state === 'linked';

  ngOnInit(): void {
    this.authState.isAuthenticated$
      .pipe(takeUntil(this.destroy$))
      .subscribe((auth) => this.isAuthenticated.set(auth));

    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([params, query]) => {
        void this.onRoute(params.get('slug') ?? '', readDirectoryQuery(query));
      });
  }

  ngOnDestroy(): void {
    this.requestGeneration++;
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async onRoute(slug: string, query: DirectoryQuery): Promise<void> {
    if (!slug) {
      this.loading.set(false);
      return;
    }
    if (slug !== this.slug) {
      this.slug = slug;
      this.appliedKey = null;
      this.loading.set(true);
      this.city.set(null);
      this.categories.set([]);
      this.categoriesUnavailable.set(false);
      try {
        const city = await this.communityService.getCityBySlug(slug);
        if (slug !== this.slug) return;
        if (!city) return;
        this.city.set(city);
        this.title.setTitle(`Business directory - ${city.name} - Towne Square`);
        void this.loadBoundary(city.id);
        void this.loadTowns();
      } finally {
        if (slug === this.slug) this.loading.set(false);
      }
    }
    const city = this.city();
    if (!city) return;
    await this.applyQuery(city.id, query);
    this.focusHeading();
  }

  private async loadTowns(): Promise<void> {
    try {
      this.towns.set(await this.communityService.getCities());
    } catch {
      this.towns.set([]);
    }
  }

  /** Moves focus to the page heading after a route change so screen-reader users hear where they are. */
  private focusHeading(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    setTimeout(() => this.pageHeading()?.nativeElement.focus(), 0);
  }

  async loadBoundary(id: string): Promise<void> {
    const generation = ++this.boundaryGeneration;
    this.directoryBoundary.set({ status: 'unavailable' });
    let result: DirectoryBoundary;
    try {
      result = await this.communityService.getDirectoryBoundary(id);
    } catch {
      result = { status: 'unavailable' };
    }
    if (generation === this.boundaryGeneration && this.city()?.id === id) {
      this.directoryBoundary.set(result);
    }
  }

  /** Brings the page in line with the URL: restore a snapshot if we have one, otherwise fetch. */
  private async applyQuery(
    townId: string,
    query: DirectoryQuery
  ): Promise<void> {
    const key = this.directoryService.snapshotKey(townId, query);
    if (key === this.appliedKey) return;
    this.appliedKey = key;
    const request = ++this.requestGeneration;
    this.filters.set({
      q: query.q,
      category: query.category,
      adult: query.adult,
    });
    this.businessLinks.set({});
    this.linkRequests.clear();
    this.moreLoading.set(false);

    const snapshot = this.directoryService.getSnapshot(key);
    if (snapshot) {
      this.show(snapshot, false);
      return;
    }

    this.listings.set([]);
    this.hasMore.set(false);
    this.nextCursor.set(null);
    this.coverage.set(null);
    this.sourceFreshness.set(null);
    this.startedMidway.set(!!query.cursor);
    this.status.set('loading');
    this.retryAction = () => {
      this.appliedKey = null;
      void this.applyQuery(townId, query);
    };
    try {
      const page = await this.directoryService.getPage(townId, query);
      if (request !== this.requestGeneration) return;
      this.directoryService.saveSnapshot(key, page);
      this.show(page, true);
    } catch (error) {
      if (request !== this.requestGeneration) return;
      if (query.cursor && this.isBadRequest(error)) {
        // The cursor expired or was altered: start again from the first page.
        this.appliedKey = null;
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { cursor: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
        return;
      }
      this.status.set('failed');
    }
  }

  private isBadRequest(error: unknown): boolean {
    return error instanceof DirectoryRequestError && error.status === 400;
  }

  private show(
    page: {
      listings: LocalDirectoryListing[];
      categories?: string[];
      hasMore: boolean;
      nextCursor: string | null;
      sourceFreshness: LocalDirectorySourceFreshness | null;
      coverage: LocalDirectoryCoverage | null;
    },
    midway: boolean
  ): void {
    this.categories.set(page.categories ?? []);
    this.categoriesUnavailable.set(page.categories === undefined);
    this.listings.set(page.listings);
    this.hasMore.set(page.hasMore && page.nextCursor !== null);
    this.nextCursor.set(page.nextCursor);
    this.sourceFreshness.set(page.sourceFreshness);
    this.coverage.set(page.coverage);
    this.status.set('ready');
    if (!midway) this.startedMidway.set(false);
  }

  retry(): void {
    this.retryAction?.();
  }

  /** Filters live in the URL so links, refresh and Back all restore them. */
  submitFilters(filters: DirectoryFilters): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: filters.q || null,
        category: filters.category || null,
        adult: filters.adult ? '1' : null,
        cursor: null,
      },
    });
  }

  /** Download the town's listings as a file. The server decides what the file may contain. */
  downloadListings(format: 'csv' | 'jsonl'): void {
    const city = this.city();
    if (!city || !isPlatformBrowser(this.platformId)) return;
    const link = document.createElement('a');
    link.href = this.directoryService.publicExportUrl(city.id, format);
    link.rel = 'noopener';
    link.download = '';
    link.click();
  }

  async loadMore(): Promise<void> {
    const city = this.city();
    const cursor = this.nextCursor();
    if (!city || !cursor || this.moreLoading()) return;
    const filters = this.filters();
    const query: DirectoryQuery = { ...filters, cursor };
    const key = this.directoryService.snapshotKey(city.id, query);
    const request = ++this.requestGeneration;
    this.moreLoading.set(true);
    this.status.set('loading');
    this.retryAction = () => void this.loadMore();
    try {
      const page = await this.directoryService.getPage(city.id, query);
      if (request !== this.requestGeneration) return;
      const merged = {
        ...page,
        listings: [...this.listings(), ...page.listings],
      };
      this.directoryService.saveSnapshot(key, merged);
      // The URL now names this page; mark it applied first so the navigation does not refetch.
      this.appliedKey = key;
      this.show(merged, true);
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { cursor },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    } catch (error) {
      if (request !== this.requestGeneration) return;
      this.status.set('failed');
    } finally {
      if (request === this.requestGeneration) this.moreLoading.set(false);
    }
  }

  startOver(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { cursor: null },
      queryParamsHandling: 'merge',
    });
  }

  async checkBusinessPage(listing: LocalDirectoryListing): Promise<void> {
    const city = this.city();
    const listingId = listing.id;
    if (!city || !listingId) return;

    const request = this.requestGeneration;
    const adult = this.filters().adult;
    this.businessLinks.update((all) => ({
      ...all,
      [listingId]: { state: 'loading' },
    }));

    try {
      const [link, requests] = await Promise.all([
        this.communityService.getDirectoryBusinessLink(
          city.id,
          listingId,
          adult
        ),
        this.isAuthenticated()
          ? this.communityService.getMyDirectoryBusinessLinks(
              city.id,
              listingId
            )
          : Promise.resolve([]),
      ]);

      if (this.city()?.id !== city.id || request !== this.requestGeneration) {
        return;
      }

      if (this.isAuthenticated() && requests.length === 0) {
        for (const key of this.linkRequests.keys()) {
          if (key.startsWith(`${city.id}:${listingId}:`)) {
            this.linkRequests.delete(key);
          }
        }
      }

      this.businessLinks.update((all) => ({
        ...all,
        [listingId]: link
          ? { state: 'linked', link, requests }
          : { state: 'unlinked', requests },
      }));
    } catch {
      if (this.city()?.id === city.id && request === this.requestGeneration) {
        this.businessLinks.update((all) => ({
          ...all,
          [listingId]: {
            state: 'error',
            message:
              'Business page information is unavailable. Please try again.',
          },
        }));
      }
    }
  }

  async requestBusinessPageLink(
    listing: LocalDirectoryListing,
    input: string
  ): Promise<void> {
    const city = this.city();
    const listingId = listing.id;
    if (!city || !listingId || !this.isAuthenticated()) return;

    let slug = input.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      try {
        const url = new URL(
          input.trim(),
          globalThis.location?.origin || 'https://local.invalid'
        );
        const match = url.pathname.match(
          /^\/c\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/
        );
        slug =
          url.origin === globalThis.location?.origin ? match?.[1] || '' : '';
      } catch {
        slug = '';
      }
    }

    if (!slug || slug.length > 100) {
      this.businessLinks.update((all) => ({
        ...all,
        [listingId]: {
          state: 'unlinked',
          message: 'Enter your Town Square business page URL or page name.',
        },
      }));
      return;
    }

    const key = `${city.id}:${listingId}:${slug}`;
    const request = this.requestGeneration;
    const adult = this.filters().adult;
    let requestId = this.linkRequests.get(key);
    if (!requestId) {
      if (typeof globalThis.crypto?.randomUUID !== 'function') {
        this.businessLinks.update((all) => ({
          ...all,
          [listingId]: {
            state: 'unlinked',
            message: 'A secure connection is required.',
          },
        }));
        return;
      }
      requestId = globalThis.crypto.randomUUID();
      this.linkRequests.set(key, requestId);
    }

    const finalRequestId = requestId;
    this.businessLinks.update((all) => ({
      ...all,
      [listingId]: { state: 'requesting' },
    }));

    try {
      await this.communityService.requestDirectoryBusinessLink(
        city.id,
        listingId,
        slug,
        finalRequestId,
        adult
      );
      if (this.city()?.id === city.id && request === this.requestGeneration) {
        this.businessLinks.update((all) => ({
          ...all,
          [listingId]: {
            state: 'requested',
            requests: [
              {
                requestId: finalRequestId,
                businessCommunityId: '',
                status: 'pending',
              },
            ],
          },
        }));
      }
    } catch {
      if (this.city()?.id === city.id && request === this.requestGeneration) {
        this.businessLinks.update((all) => ({
          ...all,
          [listingId]: {
            state: 'unlinked',
            message:
              'We could not verify the page or send your request. Please try again.',
          },
        }));
      }
    }
  }

  async revokeBusinessPageLink(
    listing: LocalDirectoryListing,
    requestId: string
  ): Promise<void> {
    const city = this.city();
    const listingId = listing.id;
    if (!city || !listingId || !this.isAuthenticated()) return;

    const request = this.requestGeneration;
    this.businessLinks.update((all) => ({
      ...all,
      [listingId]: { ...all[listingId], state: 'requesting' },
    }));

    try {
      await this.communityService.revokeDirectoryBusinessLink(
        city.id,
        listingId,
        requestId
      );
      if (this.city()?.id === city.id && request === this.requestGeneration) {
        await this.checkBusinessPage(listing);
      }
    } catch {
      if (this.city()?.id === city.id && request === this.requestGeneration) {
        this.businessLinks.update((all) => ({
          ...all,
          [listingId]: {
            state: 'error',
            message: 'The request could not be removed. Please try again.',
          },
        }));
      }
    }
  }

  navigateToCities(): void {
    void this.router.navigate(['/cities']);
  }
}
