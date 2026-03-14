import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  CommunityService,
  City,
  LocalCommunity,
} from '../../services/community.service';
import { MapComponent } from '../../components/map/map.component';

@Component({
  selector: 'app-cities',
  standalone: true,
  imports: [CommonModule, MapComponent],
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
      const [citiesData, communitiesData] = await Promise.all([
        this.communityService.getCities(),
        this.communityService.getCommunities(),
      ]);
      this.cities.set(citiesData);
      this.communities.set(communitiesData);
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
