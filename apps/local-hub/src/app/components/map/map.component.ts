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
import {
  MapCoordinates,
  MapMode,
  buildAtlasNearbySelection,
  isRenderableCoordinate,
} from './map.utils';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
})
export class MapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  @Input() mode: MapMode = 'single-location';
  @Input() cities: City[] = [];
  @Input() centerLat = 31.9;
  @Input() centerLng = -81.1;
  @Input() zoom = 7;
  @Input() centerLabel = 'Savannah, GA';
  @Input() userLocation: MapCoordinates | null = null;
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
        !changes['zoom'] &&
        !changes['mode'] &&
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

    switch (this.mode) {
      case 'atlas-nearby':
        this.renderAtlasNearbyMode(this.leaflet);
        break;
      case 'radius-focus':
        this.renderRadiusFocusMode(this.leaflet);
        break;
      case 'single-location':
      default:
        this.renderSingleLocationMode(this.leaflet);
        break;
    }
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

  private addFocusMarker(L: any): void {
    const focusCoordinates = this.getFocusCoordinates();
    if (!focusCoordinates) {
      return;
    }

    const marker = this.createMarker(L, {
      className: 'focus-marker map-marker map-marker--focus',
      html: `
        <div class="focus-marker-inner" data-map-marker-role="focus"></div>
      `,
      coordinates: focusCoordinates,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    const label = L.divIcon({
      className: 'map-label',
      html: `<span class="label-text">${this.centerLabel}</span>`,
      iconAnchor: [50, 0],
    });

    const labelMarker = L.marker([focusCoordinates.lat, focusCoordinates.lng], {
      icon: label,
      interactive: false,
    }).addTo(this.map);

    this.centerOverlays.push(marker, labelMarker);
  }

  private addLocalityMarkers(L: any, cities: City[]): void {
    cities
      .filter((city) => isRenderableCoordinate(city.coordinates))
      .forEach((city) => {
        const marker = this.createMarker(L, {
          className: 'locality-marker map-marker map-marker--locality',
          html: `
            <div class="marker-pulse" data-map-marker-role="locality"></div>
            <div class="marker-dot" data-map-marker-id="${city.id}"></div>
          `,
          coordinates: city.coordinates,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

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

    const marker = this.createMarker(L, {
      className: 'user-marker map-marker map-marker--user',
      html: `
        <div class="user-marker-ring" data-map-marker-role="user"></div>
        <div class="user-marker-dot"></div>
      `,
      coordinates: this.userLocation,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    marker.bindTooltip('Your location', {
      className: 'city-tooltip',
      direction: 'top',
      offset: [0, -12],
    });

    this.userOverlays.push(marker);
  }

  private renderAtlasNearbyMode(L: any): void {
    const selection = buildAtlasNearbySelection({
      cities: this.cities,
      userLocation: this.userLocation,
    });

    this.addLocalityMarkers(
      L,
      this.cities.filter((city) =>
        selection.markers.some((marker) => marker.id === city.id)
      )
    );

    if (this.userLocation) {
      this.addUserMarker(this.leaflet);
    }

    const viewportCoordinates = [
      ...selection.markers.map((marker) => ({
        lat: marker.lat,
        lng: marker.lng,
      })),
      ...(this.userLocation ? [this.userLocation] : []),
    ];

    this.fitMapToCoordinates(viewportCoordinates, this.userLocation ?? null);
  }

  private renderSingleLocationMode(L: any): void {
    this.addFocusMarker(L);
    const focusCoordinates = this.getFocusCoordinates();
    if (!focusCoordinates) {
      this.scheduleInvalidateSize();
      return;
    }

    this.map.setView(
      [focusCoordinates.lat, focusCoordinates.lng],
      Math.max(this.zoom, 9)
    );
    this.scheduleInvalidateSize();
  }

  private renderRadiusFocusMode(L: any): void {
    const primaryColor = this.getCssVariable('--primary', '#3b82f6');
    this.addRadiusCircle(L, primaryColor);
    this.addFocusMarker(L);

    const focusCoordinates = this.getFocusCoordinates();
    if (!focusCoordinates) {
      this.scheduleInvalidateSize();
      return;
    }

    this.map.setView([focusCoordinates.lat, focusCoordinates.lng], this.zoom);
    this.scheduleInvalidateSize();
  }

  private fitMapToCoordinates(
    coordinates: MapCoordinates[],
    userLocation: MapCoordinates | null
  ): void {
    const validCoordinates = coordinates.filter((coordinate) =>
      isRenderableCoordinate(coordinate)
    );

    if (validCoordinates.length === 0) {
      const focusCoordinates = userLocation ?? this.getFocusCoordinates();
      if (focusCoordinates) {
        this.map.setView(
          [focusCoordinates.lat, focusCoordinates.lng],
          Math.max(this.zoom, 7)
        );
      } else {
        this.map.setView([this.centerLat, this.centerLng], this.zoom);
      }
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
      if (this.mode === 'single-location' || this.mode === 'radius-focus') {
        const focusCoordinates = this.getFocusCoordinates();
        if (focusCoordinates) {
          this.map.flyTo([focusCoordinates.lat, focusCoordinates.lng], this.zoom, {
            duration: 1,
          });
          this.scheduleInvalidateSize();
          return;
        }
      }

      const selection = buildAtlasNearbySelection({
        cities: this.cities,
        userLocation: this.userLocation,
      });
      this.fitMapToCoordinates(
        [
          ...selection.markers.map((marker) => ({
            lat: marker.lat,
            lng: marker.lng,
          })),
          ...(this.userLocation ? [this.userLocation] : []),
        ],
        this.userLocation
      );
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

  private getFocusCoordinates(): MapCoordinates | null {
    const focusCoordinates = { lat: this.centerLat, lng: this.centerLng };
    return isRenderableCoordinate(focusCoordinates) ? focusCoordinates : null;
  }

  private createMarker(
    L: any,
    input: {
      className: string;
      html: string;
      coordinates: MapCoordinates;
      iconSize: [number, number];
      iconAnchor: [number, number];
    }
  ): any {
    const icon = L.divIcon({
      className: input.className,
      html: input.html,
      iconSize: input.iconSize,
      iconAnchor: input.iconAnchor,
    });

    return L.marker([input.coordinates.lat, input.coordinates.lng], {
      icon,
    }).addTo(this.map);
  }
}
