import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  City,
  CommunityService,
  DirectoryBoundary,
  LocalDirectoryListing,
} from '../../services/community.service';
import {
  describeSourceFreshness,
  LocalDirectorySourceFreshness,
} from '../../services/source-freshness';
import { AuthStateService } from '../../services/auth-state.service';
import { MapComponent } from '../../components/map/map.component';
import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  IconComponent,
  LoadingStateComponent,
} from '@optimistic-tanuki/common-ui';
import {
  CheckboxComponent,
  TextInputComponent,
} from '@optimistic-tanuki/form-ui';

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

@Component({
  selector: 'app-business-directory',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MapComponent,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    CheckboxComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    IconComponent,
    LoadingStateComponent,
    TextInputComponent,
  ],
  templateUrl: './business-directory.component.html',
  styleUrls: ['./business-directory.component.scss'],
})
export class BusinessDirectoryComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private communityService = inject(CommunityService);
  private authState = inject(AuthStateService);
  private title = inject(Title);
  private destroy$ = new Subject<void>();
  private boundaryGeneration = 0;
  private requestGeneration = 0;
  private activeQuery = '';
  private failedOffset = 0;
  private linkRequests = new Map<string, string>();

  city = signal<City | null>(null);
  directoryBoundary = signal<DirectoryBoundary>({ status: 'pending' });
  listings = signal<LocalDirectoryListing[]>([]);
  hasMore = signal(false);
  sourceFreshness = signal<LocalDirectorySourceFreshness | null>(null);
  sourceFreshnessLabel = computed(() =>
    describeSourceFreshness(this.sourceFreshness())
  );
  loading = signal(true);
  directoryLoading = signal(false);
  available = signal(false);
  directoryError = signal(false);
  isAuthenticated = signal(false);
  search = '';
  adult = false;
  businessLinks = signal<Record<string, BusinessPageLinkState>>({});

  directoryMapLocations = computed(() =>
    this.listings().flatMap((listing) =>
      listing.coordinates
        ? [
            {
              name: listing.name,
              category: listing.category,
              coordinates: listing.coordinates,
            },
          ]
        : []
    )
  );

  ngOnInit(): void {
    this.authState.isAuthenticated$
      .pipe(takeUntil(this.destroy$))
      .subscribe((auth) => this.isAuthenticated.set(auth));

    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    if (!slug) {
      this.loading.set(false);
      return;
    }

    void this.loadCity(slug);
  }

  ngOnDestroy(): void {
    this.requestGeneration++;
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadCity(slug: string): Promise<void> {
    try {
      const city = await this.communityService.getCityBySlug(slug);
      if (!city) return;

      this.city.set(city);
      this.title.setTitle(`Business directory - ${city.name} - Towne Square`);

      this.listings.set([]);
      this.businessLinks.set({});
      this.linkRequests.clear();
      this.hasMore.set(false);
      this.available.set(false);
      this.directoryError.set(false);
      this.search = '';
      this.activeQuery = '';
      this.requestGeneration++;
      this.directoryLoading.set(false);

      void this.loadBoundary(city.id);
      await this.loadPage(city.id, 0);
    } finally {
      this.loading.set(false);
    }
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

  async loadPage(id: string, offset: number): Promise<void> {
    if (this.directoryLoading()) return;

    const request = ++this.requestGeneration;
    this.directoryLoading.set(true);
    this.directoryError.set(false);

    try {
      const page = await this.communityService.getLocalDirectoryListings(
        id,
        offset,
        this.activeQuery,
        this.adult
      );
      if (request === this.requestGeneration && this.city()?.id === id) {
        this.available.set(true);
        this.listings.update((previous) =>
          offset === 0 ? page.listings : [...previous, ...page.listings]
        );
        this.hasMore.set(page.hasMore);
        if (page.sourceFreshness || offset === 0) {
          this.sourceFreshness.set(page.sourceFreshness ?? null);
        }
      }
    } catch {
      if (request === this.requestGeneration && this.city()?.id === id) {
        this.failedOffset = offset;
        this.directoryError.set(true);
      }
    } finally {
      if (request === this.requestGeneration) {
        this.directoryLoading.set(false);
      }
    }
  }

  retry(): void {
    const city = this.city();
    if (city) void this.loadPage(city.id, this.failedOffset);
  }

  searchDirectory(): void {
    const city = this.city();
    if (!city) return;

    this.activeQuery = this.search.trim();
    this.requestGeneration++;
    this.directoryLoading.set(false);
    this.listings.set([]);
    this.hasMore.set(false);
    this.businessLinks.set({});
    void this.loadPage(city.id, 0);
  }

  setAdult(enabled: boolean): void {
    this.adult = enabled === true;
    this.searchDirectory();
  }

  loadMore(): void {
    const city = this.city();
    if (city) void this.loadPage(city.id, this.listings().length);
  }

  async checkBusinessPage(listing: LocalDirectoryListing): Promise<void> {
    const city = this.city();
    const listingId = listing.id;
    if (!city || !listingId) return;

    const request = this.requestGeneration;
    const adult = this.adult;
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
    const adult = this.adult;
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
