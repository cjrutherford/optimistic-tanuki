import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  CommunityService,
  City,
  LocalCommunity,
} from '../../services/community.service';
import { MapComponent } from '../../components/map/map.component';
import { CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'app-cities',
  standalone: true,
  imports: [CommonModule, RouterLink, MapComponent, CardComponent],
  templateUrl: './cities.component.html',
  styleUrls: ['./cities.component.scss'],
})
export class CitiesComponent implements OnInit {
  private router = inject(Router);
  private communityService = inject(CommunityService);

  cities = signal<City[]>([]);
  communities = signal<LocalCommunity[]>([]);
  loading = signal(true);
  hoveredCity = signal<City | null>(null);
  selectedStates = signal<string[]>([]);

  states = ['GA', 'SC', 'FL', 'NC'];

  get filteredCities(): City[] {
    const states = this.selectedStates();
    if (states.length === 0) return this.cities();
    return this.cities().filter((city) => states.includes(city.adminArea));
  }

  get filteredCommunities(): LocalCommunity[] {
    const states = this.selectedStates();
    if (states.length === 0) return this.communities();
    return this.communities().filter((community) =>
      states.includes(community.adminArea)
    );
  }

  get activeFiltersCount(): number {
    return this.selectedStates().length;
  }

  async ngOnInit(): Promise<void> {
    try {
      const communitiesData = await this.communityService.getCommunities();
      this.communities.set(communitiesData);
      this.cities.set(
        this.communityService.getCitiesFromCommunities(communitiesData)
      );
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

  getTotalCommunities(): number {
    return this.filteredCities.reduce((sum, city) => sum + city.communities, 0);
  }
}
