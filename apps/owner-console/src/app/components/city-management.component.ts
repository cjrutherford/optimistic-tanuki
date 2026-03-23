import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  CardComponent,
  HeadingComponent,
  ButtonComponent,
} from '@optimistic-tanuki/common-ui';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { CommunityDto, LocalityType } from '@optimistic-tanuki/ui-models';
import { CommunityService } from '../services/community.service';

@Component({
  selector: 'app-city-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    HeadingComponent,
    ButtonComponent,
  ],
  templateUrl: './city-management.component.html',
  styles: [
    `
      :host {
        display: block;
        padding: var(--spacing-md);
      }
      .filters {
        display: flex;
        gap: var(--spacing-md);
        margin-bottom: var(--spacing-md);
        flex-wrap: wrap;
        align-items: center;
      }
      .search-input {
        flex: 1;
        min-width: 200px;
        padding: 8px 12px;
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-sm);
        font-size: 14px;
        background: var(--bg-primary);
        color: var(--text-primary);
      }
      .search-input:focus {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 2px rgba(63, 81, 181, 0.2);
      }
      .filter-select {
        padding: 8px 12px;
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-sm);
        font-size: 14px;
        background: var(--bg-primary);
        color: var(--text-primary);
      }
      .city-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: var(--spacing-md);
        margin-top: var(--spacing-md);
      }
      .city-card {
        padding: var(--spacing-md);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-md);
        background: var(--surface);
        cursor: pointer;
        transition: box-shadow 0.2s, transform 0.2s;
      }
      .city-card:hover {
        box-shadow: var(--shadow-md);
        transform: translateY(-2px);
      }
      .city-card h3 {
        margin: 0 0 var(--spacing-sm) 0;
        color: var(--text-primary);
      }
      .city-card p {
        margin: 0 0 var(--spacing-sm) 0;
        color: var(--text-secondary);
      }
      .city-actions {
        display: flex;
        gap: var(--spacing-sm);
        margin-top: var(--spacing-sm);
      }
      .loading-state {
        text-align: center;
        padding: var(--spacing-xl);
        color: var(--text-secondary);
      }
    `,
  ],
})
export class CityManagementComponent implements OnInit {
  cities: CommunityDto[] = [];
  filteredCities: CommunityDto[] = [];
  loading = false;

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

  ngOnInit(): void {
    this.loadCities();
  }

  loadCities(): void {
    this.loading = true;
    this.communityService.getCities().subscribe({
      next: (cities) => {
        this.cities = cities;
        this.applyFiltersAndSort();
        this.loading = false;
        if (cities.length === 0) {
          this.messageService.addMessage({
            content: 'No cities found.',
            type: 'info',
          });
        }
      },
      error: (err) => {
        this.loading = false;
        this.messageService.addMessage({
          content: err.error?.message || 'Failed to load cities.',
          type: 'error',
        });
      },
    });
  }

  applyFiltersAndSort(): void {
    let result = [...this.cities];

    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.description?.toLowerCase().includes(query) ||
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

  deleteCity(city: CommunityDto, event: Event): void {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete "${city.name}"?`)) {
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
}
