import {
  Component,
  Input,
  Output,
  EventEmitter,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser, DOCUMENT } from '@angular/common';
import { City } from '../../services/community.service';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  @Input() cities: City[] = [];
  @Input() centerLat = 31.9;
  @Input() centerLng = -81.1;
  @Input() zoom = 7;
  @Input() centerLabel = 'Savannah, GA';
  @Output() citySelected = new EventEmitter<City>();

  private platformId = inject(PLATFORM_ID);
  private document = inject(DOCUMENT);
  private map: any;
  private markers: any[] = [];
  private radiusCircle: any;

  isBrowser = signal(false);
  isLoading = signal(true);

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.isBrowser.set(true);
      this.loadLeafletCss().then(() => {
        this.initMap();
      });
    }
  }

  ngOnDestroy(): void {
    if (this.map && isPlatformBrowser(this.platformId)) {
      this.map.remove();
    }
  }

  private loadLeafletCss(): Promise<void> {
    return new Promise((resolve) => {
      if (this.document.getElementById('leaflet-css')) {
        resolve();
        return;
      }
      const link = this.document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.onload = () => resolve();
      this.document.head.appendChild(link);
    });
  }

  private async initMap(): Promise<void> {
    const leafletModule = await import('leaflet');
    const L: typeof import('leaflet') = (leafletModule as any).default ?? leafletModule;

    const primaryColor = this.getCssVariable('--primary', '#3b82f6');
    const primaryColorRgb = this.hexToRgba(primaryColor, 0.08);
    const primaryColorRgb15 = this.hexToRgba(primaryColor, 0.15);

    this.map = L.map(this.mapContainer.nativeElement, {
      center: [this.centerLat, this.centerLng],
      zoom: this.zoom,
      zoomControl: false,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(this.map);

    L.control
      .zoom({
        position: 'bottomright',
      })
      .addTo(this.map);

    this.addRadiusCircle(L, primaryColor, primaryColorRgb, primaryColorRgb15);
    this.addMarkers(L);
    this.isLoading.set(false);
  }

  private addRadiusCircle(
    L: any,
    primaryColor: string,
    primaryColorRgb: string,
    primaryColorRgb15: string
  ): void {
    const radiusMiles = 250;
    const radiusKm = radiusMiles * 1.60934;

    this.radiusCircle = L.circle([this.centerLat, this.centerLng], {
      radius: radiusKm * 1000,
      color: primaryColor,
      weight: 2,
      fillColor: primaryColor,
      fillOpacity: 0.08,
      dashArray: '4, 4',
    }).addTo(this.map);

    L.circle([this.centerLat, this.centerLng], {
      radius: radiusKm * 1000,
      fillColor: primaryColor,
      fillOpacity: 0.15,
      weight: 0,
    }).addTo(this.map);
  }

  private addMarkers(L: any): void {
    const centerIcon = L.divIcon({
      className: 'center-marker',
      html: `<div class="center-marker-inner"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    L.marker([this.centerLat, this.centerLng], { icon: centerIcon }).addTo(
      this.map
    );

    const savannahLabel = L.divIcon({
      className: 'map-label',
      html: `<span class="label-text">${this.centerLabel}</span>`,
      iconAnchor: [50, 0],
    });

    L.marker([this.centerLat, this.centerLng], { icon: savannahLabel }).addTo(
      this.map
    );

    this.cities.forEach((city) => {
      const icon = L.divIcon({
        className: 'city-marker',
        html: `
          <div class="marker-pulse"></div>
          <div class="marker-dot"></div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([city.coordinates.lat, city.coordinates.lng], {
        icon,
      }).addTo(this.map);

      marker.bindTooltip(city.name, {
        className: 'city-tooltip',
        direction: 'top',
        offset: [0, -10],
      });

      marker.on('click', () => {
        this.citySelected.emit(city);
      });

      this.markers.push(marker);
    });
  }

  flyToCity(city: City): void {
    if (this.map) {
      this.map.flyTo([city.coordinates.lat, city.coordinates.lng], 10, {
        duration: 1.5,
      });
    }
  }

  resetView(): void {
    if (this.map) {
      this.map.flyTo([this.centerLat, this.centerLng], this.zoom, {
        duration: 1,
      });
    }
  }

  private getCssVariable(variable: string, fallback: string): string {
    const root = this.document.documentElement;
    const computedStyle =
      root.ownerDocument.defaultView?.getComputedStyle(root);
    return computedStyle?.getPropertyValue(variable).trim() || fallback;
  }

  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
