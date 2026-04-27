import {
  Component,
  Input,
  Output,
  EventEmitter,
  AfterViewInit,
  OnChanges,
  OnDestroy,
  ElementRef,
  ViewChild,
  PLATFORM_ID,
  inject,
  signal,
  SimpleChanges,
  NgZone,
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
export class MapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  @Input() cities: City[] = [];
  @Input() centerLat = 31.9;
  @Input() centerLng = -81.1;
  @Input() zoom = 7;
  @Input() centerLabel = 'Savannah, GA';
  @Input() showRadius = false;
  @Input() preferUserLocation = false;
  @Input() userLocation: { lat: number; lng: number } | null = null;
  @Output() citySelected = new EventEmitter<City>();

  private platformId = inject(PLATFORM_ID);
  private document = inject(DOCUMENT);
  private ngZone = inject(NgZone);
  private map: any;
  private leaflet: any;
  private tileLayer: any;
  private markers: any[] = [];
  private centerOverlays: any[] = [];
  private radiusOverlays: any[] = [];
  private userOverlays: any[] = [];
  private resizeObserver?: ResizeObserver;
  isBrowser = signal(false);
  isLoading = signal(true);

  ngOnChanges(changes: SimpleChanges): void {
    if (
      !this.map ||
      !this.leaflet ||
      (!changes['cities'] &&
        !changes['centerLat'] &&
        !changes['centerLng'] &&
        !changes['centerLabel'] &&
        !changes['showRadius'] &&
        !changes['zoom'] &&
        !changes['preferUserLocation'] &&
        !changes['userLocation'])
    ) {
      return;
    }

    this.refreshMapContent();
  }

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
      this.resizeObserver?.disconnect();
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
    const L: typeof import('leaflet') =
      (leafletModule as any).default ?? leafletModule;
    this.leaflet = L;

    const primaryColor = this.getCssVariable('--primary', '#3b82f6');
    const secondaryColor = this.getCssVariable('--secondary', primaryColor);
    const surfaceColor = this.getCssVariable('--surface', '#ffffff');
    const borderColor = this.getCssVariable('--border', 'rgba(0, 0, 0, 0.16)');
    const foregroundColor = this.getCssVariable('--foreground', '#111827');
    const accentColor = this.getCssVariable('--accent', primaryColor);

    this.document.documentElement.style.setProperty('--map-primary', primaryColor);
    this.document.documentElement.style.setProperty(
      '--map-secondary',
      secondaryColor
    );
    this.document.documentElement.style.setProperty('--map-surface', surfaceColor);
    this.document.documentElement.style.setProperty('--map-border', borderColor);
    this.document.documentElement.style.setProperty(
      '--map-foreground',
      foregroundColor
    );
    this.document.documentElement.style.setProperty('--map-label', accentColor);

    this.map = L.map(this.mapContainer.nativeElement, {
      center: [this.centerLat, this.centerLng],
      zoom: this.zoom,
      zoomControl: false,
      attributionControl: true,
      zoomSnap: 0.5,
      wheelPxPerZoomLevel: 100,
      trackResize: true,
    });

    this.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
      minZoom: 3,
      noWrap: false,
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 6,
    }).addTo(this.map);

    L.control
      .zoom({
        position: 'bottomright',
      })
      .addTo(this.map);

    this.map.on('zoomend moveend', () => this.scheduleInvalidateSize());
    this.map.on('load', () => this.scheduleInvalidateSize());
    this.setupResizeObserver();

    this.refreshMapContent();
    this.isLoading.set(false);
  }

  private refreshMapContent(): void {
    if (!this.map || !this.leaflet) {
      return;
    }

    this.clearOverlays();

    const primaryColor = this.getCssVariable('--primary', '#3b82f6');
    if (this.showRadius) {
      this.addRadiusCircle(this.leaflet, primaryColor);
      this.addCenterMarker(this.leaflet);
    }
    this.addMarkers(this.leaflet);
    this.focusMapView();
  }

  private clearOverlays(): void {
    for (const marker of this.markers) {
      marker.remove();
    }
    for (const overlay of this.centerOverlays) {
      overlay.remove();
    }
    for (const overlay of this.radiusOverlays) {
      overlay.remove();
    }
    for (const overlay of this.userOverlays) {
      overlay.remove();
    }

    this.markers = [];
    this.centerOverlays = [];
    this.radiusOverlays = [];
    this.userOverlays = [];
  }

  private addRadiusCircle(L: any, primaryColor: string): void {
    const radiusMiles = 250;
    const radiusKm = radiusMiles * 1.60934;

    const outline = L.circle([this.centerLat, this.centerLng], {
      radius: radiusKm * 1000,
      color: primaryColor,
      weight: 2,
      fillColor: primaryColor,
      fillOpacity: 0.08,
      dashArray: '4, 4',
    }).addTo(this.map);

    const fill = L.circle([this.centerLat, this.centerLng], {
      radius: radiusKm * 1000,
      fillColor: primaryColor,
      fillOpacity: 0.15,
      weight: 0,
    }).addTo(this.map);

    this.radiusOverlays.push(outline, fill);
  }

  private addCenterMarker(L: any): void {
    const centerIcon = L.divIcon({
      className: 'center-marker',
      html: `<div class="center-marker-inner"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    const centerMarker = L.marker([this.centerLat, this.centerLng], {
      icon: centerIcon,
    }).addTo(this.map);

    const centerLabel = L.divIcon({
      className: 'map-label',
      html: `<span class="label-text">${this.centerLabel}</span>`,
      iconAnchor: [50, 0],
    });

    const centerLabelMarker = L.marker([this.centerLat, this.centerLng], {
      icon: centerLabel,
    }).addTo(this.map);

    this.centerOverlays.push(centerMarker, centerLabelMarker);
  }

  private addMarkers(L: any): void {
    this.cities
      .filter(
        (city) =>
          Number.isFinite(city.coordinates?.lat) &&
          Number.isFinite(city.coordinates?.lng)
      )
      .forEach((city) => {
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

  private addUserMarker(L: any): void {
    if (!this.userLocation) {
      return;
    }

    const userIcon = L.divIcon({
      className: 'user-marker',
      html: `
        <div class="user-marker-ring"></div>
        <div class="user-marker-dot"></div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const marker = L.marker([this.userLocation.lat, this.userLocation.lng], {
      icon: userIcon,
    }).addTo(this.map);

    marker.bindTooltip('Your location', {
      className: 'city-tooltip',
      direction: 'top',
      offset: [0, -12],
    });

    this.userOverlays.push(marker);
  }

  private focusMapView(): void {
    if (this.preferUserLocation && this.userLocation) {
      this.addUserMarker(this.leaflet);
      this.map.setView(
        [this.userLocation.lat, this.userLocation.lng],
        Math.max(this.zoom, 7)
      );
      this.scheduleInvalidateSize();
      return;
    }

    this.fitMapToCities();
  }

  private fitMapToCities(): void {
    const validCoordinates = this.cities
      .map((city) => city.coordinates)
      .filter(
        (coordinates): coordinates is { lat: number; lng: number } =>
          Number.isFinite(coordinates?.lat) && Number.isFinite(coordinates?.lng)
      );

    if (validCoordinates.length === 0) {
      this.map.setView([this.centerLat, this.centerLng], this.zoom);
      this.scheduleInvalidateSize();
      return;
    }

    if (validCoordinates.length === 1) {
      const [coordinates] = validCoordinates;
      this.map.setView(
        [coordinates.lat, coordinates.lng],
        Math.max(this.zoom, 9)
      );
      this.scheduleInvalidateSize();
      return;
    }

    const bounds = this.leaflet.latLngBounds(
      validCoordinates.map((coordinates) => [coordinates.lat, coordinates.lng])
    );
    this.map.fitBounds(bounds.pad(0.2), {
      maxZoom: Math.max(this.zoom, 8),
    });
    this.scheduleInvalidateSize();
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
      if (this.preferUserLocation && this.userLocation) {
        this.map.flyTo([this.userLocation.lat, this.userLocation.lng], 7, {
          duration: 1,
        });
        this.scheduleInvalidateSize();
        return;
      }

      this.fitMapToCities();
    }
  }

  private setupResizeObserver(): void {
    if (
      !isPlatformBrowser(this.platformId) ||
      typeof ResizeObserver === 'undefined'
    ) {
      return;
    }

    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.scheduleInvalidateSize());
    this.resizeObserver.observe(this.mapContainer.nativeElement);
  }

  private scheduleInvalidateSize(): void {
    if (!this.map) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        if (!this.map) {
          return;
        }
        this.map.invalidateSize(false);
        this.tileLayer?.redraw?.();
      });
    });
  }

  private getCssVariable(variable: string, fallback: string): string {
    const root = this.document.documentElement;
    const computedStyle =
      root.ownerDocument.defaultView?.getComputedStyle(root);
    return computedStyle?.getPropertyValue(variable).trim() || fallback;
  }
}
