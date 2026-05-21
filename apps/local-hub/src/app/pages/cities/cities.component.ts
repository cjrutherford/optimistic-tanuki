import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PLATFORM_ID } from '@angular/core';
import {
  CommunityService,
  City,
  LocalCommunity,
} from '../../services/community.service';
import { MapComponent } from '../../components/map/map.component';
import { CardComponent } from '@optimistic-tanuki/common-ui';
import { AuthStateService } from '../../services/auth-state.service';

@Component({
  selector: 'app-cities',
  standalone: true,
  imports: [CommonModule, FormsModule, MapComponent, CardComponent],
  templateUrl: './cities.component.html',
  styleUrls: ['./cities.component.scss'],
})
export class CitiesComponent implements OnInit {
  private router = inject(Router);
  private communityService = inject(CommunityService);
  private authState = inject(AuthStateService);
  private platformId = inject(PLATFORM_ID);

  cities = signal<City[]>([]);
  communities = signal<LocalCommunity[]>([]);
  myCommunities = signal<LocalCommunity[]>([]);
  loading = signal(true);
  hoveredCity = signal<City | null>(null);
  selectedStates = signal<string[]>([]);
  selectedCommunityTypes = signal<LocalCommunity['localityType'][]>([]);
  searchQuery = signal('');
  isAuthenticated = signal(false);
  userLocation = signal<{ lat: number; lng: number } | null>(null);

  sections = signal({
    filters: true,
    cities: true,
    myCommunities: true,
    communities: true,
  });

  availableStates = computed(() =>
    Array.from(
      new Set(
        this.communities()
          .map((community) => community.adminArea?.trim())
          .filter((state): state is string => !!state)
      )
    ).sort((left, right) => left.localeCompare(right))
  );

  communityTypes: LocalCommunity['localityType'][] = [
    'city',
    'county',
    'neighborhood',
    'region',
    'town',
  ];

  filteredCities = computed(() => {
    const states = this.selectedStates();
    const query = this.normalizeSearchValue(this.searchQuery());

    return this.cities().filter((city) => {
      const matchesState = states.length === 0 || states.includes(city.adminArea);
      const citySearchCorpus = [
        city.name,
        city.adminArea,
        city.description,
        city.timezone,
        ...(city.highlights ?? []).flatMap((highlight) => [
          highlight?.headline,
          highlight?.link,
        ]),
      ];
      const matchesQuery = this.matchesSearchQuery(query, citySearchCorpus);

      return matchesState && matchesQuery;
    });
  });

  filteredCommunities = computed(() => {
    const states = this.selectedStates();
    const types = this.selectedCommunityTypes();
    const query = this.normalizeSearchValue(this.searchQuery());

    return this.communities().filter((community) => {
      const matchesState =
        states.length === 0 || states.includes(community.adminArea);
      const matchesType =
        types.length === 0 || types.includes(community.localityType);
      const communitySearchCorpus = [
        community.name,
        community.city,
        community.adminArea,
        community.description,
        community.localityType,
        community.timezone,
        ...(community.tags ?? []).map((tag) => tag?.name),
        ...(community.highlights ?? []).flatMap((highlight) => [
          highlight?.headline,
          highlight?.link,
        ]),
      ];
      const matchesQuery = this.matchesSearchQuery(
        query,
        communitySearchCorpus
      );

      return matchesState && matchesType && matchesQuery;
    });
  });

  filteredMyCommunities = computed(() => {
    const states = this.selectedStates();
    const types = this.selectedCommunityTypes();
    const query = this.normalizeSearchValue(this.searchQuery());

    return this.myCommunities().filter((community) => {
      const matchesState =
        states.length === 0 || states.includes(community.adminArea);
      const matchesType =
        types.length === 0 || types.includes(community.localityType);
      const communitySearchCorpus = [
        community.name,
        community.city,
        community.adminArea,
        community.description,
        community.localityType,
        community.timezone,
        ...(community.tags ?? []).map((tag) => tag?.name),
      ];
      const matchesQuery = this.matchesSearchQuery(
        query,
        communitySearchCorpus
      );

      return matchesState && matchesType && matchesQuery;
    });
  });

  get activeFiltersCount(): number {
    return (
      this.selectedStates().length +
      this.selectedCommunityTypes().length +
      (this.searchQuery().trim() ? 1 : 0)
    );
  }

  get signedIn(): boolean {
    return this.isAuthenticated();
  }

  async ngOnInit(): Promise<void> {
    this.isAuthenticated.set(this.authState.isAuthenticated);
    this.loadUserLocation();

    try {
      const communitiesData = await this.communityService.getCommunities();
      this.communities.set(communitiesData);
      this.cities.set(
        this.communityService.getCitiesFromCommunities(communitiesData)
      );

      if (this.authState.isAuthenticated) {
        await this.loadMyCommunities();
      }
    } catch (e) {
      console.error('Failed to load cities', e);
    } finally {
      this.loading.set(false);
    }
  }

  toggleState(state: string): void {
    const current = this.selectedStates();
    if (current.includes(state)) {
      this.selectedStates.set(current.filter((s) => s !== state));
    } else {
      this.selectedStates.set([...current, state]);
    }
  }

  clearFilters(): void {
    this.selectedStates.set([]);
    this.selectedCommunityTypes.set([]);
    this.searchQuery.set('');
  }

  toggleCommunityType(type: LocalCommunity['localityType']): void {
    const current = this.selectedCommunityTypes();
    if (current.includes(type)) {
      this.selectedCommunityTypes.set(current.filter((item) => item !== type));
    } else {
      this.selectedCommunityTypes.set([...current, type]);
    }
  }

  navigateToCity(slug: string): void {
    this.router.navigate(['/city', slug]);
  }

  navigateToCommunity(slug: string): void {
    this.router.navigate(['/c', slug]);
  }

  onCityHover(city: City | null): void {
    this.hoveredCity.set(city);
  }

  onMapCitySelect(city: City): void {
    this.navigateToCity(city.slug);
  }

  toggleSection(section: keyof ReturnType<CitiesComponent['sections']>): void {
    this.sections.update((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  isSectionExpanded(
    section: keyof ReturnType<CitiesComponent['sections']>
  ): boolean {
    return this.sections()[section];
  }

  async loadMyCommunities(): Promise<void> {
    try {
      const memberships = await this.communityService.getMyMemberships();
      this.myCommunities.set(memberships);
    } catch {
      this.myCommunities.set([]);
    }
  }

  trackById(_index: number, item: City | LocalCommunity): string {
    return item.id;
  }

  private normalizeSearchValue(value: unknown): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  private matchesSearchQuery(query: string, values: Array<unknown>): boolean {
    if (!query) {
      return true;
    }

    return values.some((value) => this.normalizeSearchValue(value).includes(query));
  }

  getTotalCommunities(): number {
    return this.filteredCities().reduce(
      (sum, city) => sum + city.communities,
      0
    );
  }

  private loadUserLocation(): void {
    if (
      !isPlatformBrowser(this.platformId) ||
      typeof navigator === 'undefined' ||
      !navigator.geolocation
    ) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.userLocation.set({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        this.userLocation.set(null);
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 300000,
      }
    );
  }
}
