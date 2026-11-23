import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import {
  OwnerConfirmService,
  OwnerFilterBarComponent,
  OwnerPageHeaderComponent,
  OwnerStateComponent,
} from '@optimistic-tanuki/owner-page-ui';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { CommunityDto, LocalityType } from '@optimistic-tanuki/ui-models';
import { CommunityService } from '../services/community.service';

@Component({
  selector: 'app-city-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    OwnerFilterBarComponent,
    OwnerPageHeaderComponent,
    OwnerStateComponent,
  ],
  templateUrl: './city-management.component.html',
  styleUrls: ['./city-management.component.scss'],
})
export class CityManagementComponent implements OnInit {
  cities: CommunityDto[] = [];
  filteredCities: CommunityDto[] = [];
  loading = false;
  /** Set when the list could not be loaded; shows Unavailable + Retry. */
  loadError = '';
  readonly governanceSummary =
    'City records are governed through Community Ops permissions on the shared communities API.';

  searchQuery = '';
  sortBy: 'name' | 'population' | 'createdAt' = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';
  filterLocalityType: string = '';

  localityTypeOptions = [
    { value: '', label: 'All Types' },
    { value: LocalityType.CITY, label: 'City' },
    { value: LocalityType.TOWN, label: 'Town' },
    { value: LocalityType.NEIGHBORHOOD, label: 'Neighborhood' },
    { value: LocalityType.COUNTY, label: 'County' },
    { value: LocalityType.REGION, label: 'Region' },
  ];

  constructor(
    private communityService: CommunityService,
    private router: Router,
    private messageService: MessageService
  ) {}

  private readonly confirmService = inject(OwnerConfirmService);

  ngOnInit(): void {
    this.loadCities();
  }

  loadCities(): void {
    this.loading = true;
    this.loadError = '';
    this.communityService.getCities().subscribe({
      next: (cities) => {
        this.cities = Array.isArray(cities) ? cities : [];
        this.applyFiltersAndSort();
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.cities = [];
        this.filteredCities = [];
        this.loadError = err?.error?.message || 'Failed to load cities.';
      },
    });
  }

  /** The card summary: the first 100 characters, safe when a record has none. */
  blurb(description: string | null | undefined): string {
    const text = description ?? '';
    return text.length > 100 ? `${text.slice(0, 100)}...` : text;
  }

  /** "City, Area, CC" with whatever parts the record has. */
  place(city: CommunityDto): string {
    return [city.city, city.adminArea, city.countryCode]
      .filter((part) => !!part)
      .join(', ');
  }

  applyFiltersAndSort(): void {
    let result = [...this.cities];

    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          (c.name ?? '').toLowerCase().includes(query) ||
          (c.description ?? '').toLowerCase().includes(query) ||
          c.city?.toLowerCase().includes(query) ||
          c.adminArea?.toLowerCase().includes(query)
      );
    }

    if (this.filterLocalityType) {
      result = result.filter((c) => c.localityType === this.filterLocalityType);
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (this.sortBy === 'name') {
        comparison = (a.name || '').localeCompare(b.name || '');
      } else if (this.sortBy === 'population') {
        comparison = (a.population || 0) - (b.population || 0);
      } else if (this.sortBy === 'createdAt') {
        comparison =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });

    this.filteredCities = result;
  }

  onSearch(query: string): void {
    this.searchQuery = query;
    this.applyFiltersAndSort();
  }

  onSearchChange(): void {
    this.applyFiltersAndSort();
  }

  onSortChange(column: 'name' | 'population' | 'createdAt'): void {
    if (this.sortBy === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortDirection = 'asc';
    }
    this.applyFiltersAndSort();
  }

  onFilterChange(): void {
    this.applyFiltersAndSort();
  }

  createNew(): void {
    this.router.navigate(['/dashboard/cities/new']);
  }

  editCity(city: CommunityDto): void {
    this.router.navigate(['/dashboard/cities', city.id]);
  }

  async deleteCity(city: CommunityDto, event?: Event): Promise<void> {
    event?.stopPropagation?.();
    const result = await this.confirmService.confirm({
      level: 'typed',
      title: 'Delete this city',
      body: `Deleting ${city.name} cannot be undone. Everything attached to the city record goes with it.`,
      confirmLabel: 'Delete city',
      typedPhrase: city.name || city.id,
      destructive: true,
    });
    if (!result.confirmed) return;
    this.communityService.deleteCity(city.id).subscribe({
      next: () => {
        this.messageService.addMessage({
          content: 'City deleted successfully.',
          type: 'success',
        });
        this.loadCities();
      },
      error: (err) => {
        this.messageService.addMessage({
          content: err.error?.message || 'Failed to delete city.',
          type: 'error',
        });
      },
    });
  }
}
