import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CommunityService, City } from '../../services/community.service';

interface MarkerPosition {
  x: number;
  y: number;
}

const SAVANNAH_CENTER = { lat: 31.9, lng: -81.1 };
const RADIUS_DEGREES = 3.6;
const VIEWBOX_WIDTH = 400;
const VIEWBOX_HEIGHT = 300;

@Component({
  selector: 'app-cities',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cities.component.html',
  styleUrls: ['./cities.component.scss'],
})
export class CitiesComponent implements OnInit {
  private router = inject(Router);
  private communityService = inject(CommunityService);

  cities = signal<City[]>([]);
  loading = signal(true);
  hoveredCity = signal<City | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const data = await this.communityService.getCities();
      this.cities.set(data);
    } catch (e) {
      console.error('Failed to load cities', e);
    } finally {
      this.loading.set(false);
    }
  }

  navigateToCity(slug: string): void {
    this.router.navigate(['/city', slug]);
  }

  onCityHover(city: City | null): void {
    this.hoveredCity.set(city);
  }

  getMarkerPosition(city: City): MarkerPosition {
    const lat = city.coordinates.lat;
    const lng = city.coordinates.lng;

    const latRange = RADIUS_DEGREES * 2;
    const lngRange = RADIUS_DEGREES * 2.5;
    const x =
      ((lng - SAVANNAH_CENTER.lng + lngRange / 2) / lngRange) * VIEWBOX_WIDTH;
    const y =
      ((SAVANNAH_CENTER.lat + latRange / 2 - lat) / latRange) * VIEWBOX_HEIGHT;

    return { x, y };
  }

  getSavannahMarker(): MarkerPosition {
    const x = VIEWBOX_WIDTH / 2;
    const y = VIEWBOX_HEIGHT / 2;
    return { x, y };
  }

  getRadiusRadius(): number {
    return (RADIUS_DEGREES / (RADIUS_DEGREES * 2.5)) * VIEWBOX_WIDTH;
  }

  getTotalCommunities(): number {
    return this.cities().reduce((sum, city) => sum + city.communities, 0);
  }
}
