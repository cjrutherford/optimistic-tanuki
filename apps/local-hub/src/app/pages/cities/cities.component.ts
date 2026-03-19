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

  async ngOnInit(): Promise<void> {
    try {
      // Fetch communities once, then derive the cities list from the same data
      // to avoid a redundant second HTTP request.
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
    return this.cities().reduce((sum, city) => sum + city.communities, 0);
  }
}
