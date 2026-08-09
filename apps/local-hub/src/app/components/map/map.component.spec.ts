import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { readFileSync } from 'fs';
import { join } from 'path';

import { MapComponent } from './map.component';

const mockLeafletMap = {
  fitBounds: jest.fn(),
  invalidateSize: jest.fn(),
  on: jest.fn(),
  setView: jest.fn(),
};
const mockLeafletTileLayer: { addTo: jest.Mock } = {
  addTo: jest.fn(),
};
const mockLeafletZoomControl = {
  addTo: jest.fn(),
};
const mockLeafletMarker: {
  addTo: jest.Mock;
  bindTooltip: jest.Mock;
  on: jest.Mock;
  remove: jest.Mock;
} = {
  addTo: jest.fn(),
  bindTooltip: jest.fn(),
  on: jest.fn(),
  remove: jest.fn(),
};
const mockLeafletBounds: { pad: jest.Mock } = {
  pad: jest.fn(),
};
const mockLeaflet = {
  circle: jest.fn(() => mockLeafletMarker),
  control: {
    zoom: jest.fn(() => mockLeafletZoomControl),
  },
  divIcon: jest.fn((options) => options),
  latLngBounds: jest.fn(() => mockLeafletBounds),
  map: jest.fn(() => mockLeafletMap),
  marker: jest.fn(() => mockLeafletMarker),
  tileLayer: jest.fn(() => mockLeafletTileLayer),
};

jest.mock('leaflet', () => ({
  __esModule: true,
  default: mockLeaflet,
}));

describe('MapComponent', () => {
  let fixture: ComponentFixture<MapComponent>;
  let component: MapComponent;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLeafletTileLayer.addTo.mockReturnValue(mockLeafletTileLayer);
    mockLeafletMarker.addTo.mockReturnValue(mockLeafletMarker);
    mockLeafletBounds.pad.mockReturnValue(mockLeafletBounds);

    await TestBed.configureTestingModule({
      imports: [MapComponent],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();

    fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('keeps the map container rendered while loading', () => {
    component.isLoading.set(true);
    fixture.detectChanges();

    const container: HTMLElement | null =
      fixture.nativeElement.querySelector('.map-container');

    expect(container).not.toBeNull();
    expect(container?.classList.contains('hidden')).toBe(false);
  });

  it('does not override Leaflet marker icon absolute positioning', () => {
    const styles = readFileSync(join(__dirname, 'map.component.scss'), 'utf8');

    for (const markerClass of [
      '.focus-marker',
      '.locality-marker',
      '.user-marker',
      '.map-label',
    ]) {
      const block = styles.match(new RegExp(`${markerClass}\\s*\\{([^}]*)\\}`));

      expect(block?.[1]).not.toContain('position: relative');
    }
  });

  it('renders the user marker in single-location mode when a user location is available', () => {
    const markerRemove = jest.fn();
    const addedMarkers: Array<{ coordinates: [number, number]; options: any }> =
      [];
    const leaflet = {
      divIcon: jest.fn((options) => options),
      marker: jest.fn((coordinates, options) => {
        const marker: {
          bindTooltip: jest.Mock;
          addTo: jest.Mock;
          remove: jest.Mock;
        } = {
          bindTooltip: jest.fn(),
          addTo: jest.fn(),
          remove: markerRemove,
        };
        marker.addTo.mockReturnValue(marker);
        addedMarkers.push({ coordinates, options });
        return marker;
      }),
    };

    (component as any).leaflet = leaflet;
    (component as any).map = {
      setView: jest.fn(),
      invalidateSize: jest.fn(),
    };
    (component as any).tileLayer = { addTo: jest.fn(), redraw: jest.fn() };
    component.mode = 'single-location';
    component.centerLat = 32.0809;
    component.centerLng = -81.0912;
    component.userLocation = { lat: 32.05, lng: -81.1 };

    (component as any).refreshMapContent();

    expect(
      addedMarkers.some((entry) =>
        entry.options.icon.className.includes('map-marker--user')
      )
    ).toBe(true);
  });

  it('invalidates map size without forcing tile layer redraws', () => {
    jest.useFakeTimers();
    const requestAnimationFrameSpy = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        return window.setTimeout(() => callback(0), 0);
      });
    const invalidateSize = jest.fn();
    const redraw = jest.fn();

    (component as any).map = { invalidateSize };
    (component as any).tileLayer = { redraw };

    (component as any).scheduleInvalidateSize();
    jest.runOnlyPendingTimers();
    jest.runOnlyPendingTimers();

    expect(invalidateSize).toHaveBeenCalledWith(true);
    expect(redraw).not.toHaveBeenCalled();

    requestAnimationFrameSpy.mockRestore();
    jest.useRealTimers();
  });

  it('sets the initial map view before attaching the tile layer', async () => {
    component.mode = 'atlas-nearby';
    component.cities = [
      {
        id: 'city-1',
        name: 'Savannah',
        slug: 'savannah-ga',
        countryCode: 'US',
        adminArea: 'GA',
        description: 'Coastal city',
        imageUrl: '',
        coordinates: { lat: 32.0809, lng: -81.0912 },
        population: 1,
        timezone: 'America/New_York',
        highlights: [],
        communities: 1,
      },
    ];

    await (component as any).initMap();

    expect(mockLeafletMap.setView).toHaveBeenCalled();
    expect(mockLeafletTileLayer.addTo).toHaveBeenCalledWith(mockLeafletMap);
    expect(mockLeafletMap.setView.mock.invocationCallOrder[0]).toBeLessThan(
      mockLeafletTileLayer.addTo.mock.invocationCallOrder[0]
    );
  });

  it('creates atlas maps with an initial view from available city content', async () => {
    component.mode = 'atlas-nearby';
    component.zoom = 6;
    component.cities = [
      {
        id: 'city-1',
        name: 'Savannah',
        slug: 'savannah-ga',
        countryCode: 'US',
        adminArea: 'GA',
        description: 'Coastal city',
        imageUrl: '',
        coordinates: { lat: 32.0809, lng: -81.0912 },
        population: 1,
        timezone: 'America/New_York',
        highlights: [],
        communities: 1,
      },
    ];

    await (component as any).initMap();

    expect(mockLeaflet.map).toHaveBeenCalledWith(
      component.mapContainer.nativeElement,
      expect.objectContaining({
        center: [32.0809, -81.0912],
        zoom: 9,
      })
    );
  });

  it('does not initialize a map view from invalid input coordinates', async () => {
    component.mode = 'single-location';
    component.centerLat = 95;
    component.centerLng = -181;
    component.zoom = 6;

    await (component as any).initMap();

    expect(mockLeaflet.map).toHaveBeenCalledWith(
      component.mapContainer.nativeElement,
      expect.objectContaining({
        center: [31.9, -81.1],
        zoom: 6,
      })
    );
  });

  it('defers atlas tile attachment until map content is available', async () => {
    component.mode = 'atlas-nearby';
    component.cities = [];

    await (component as any).initMap();

    expect(mockLeafletTileLayer.addTo).not.toHaveBeenCalled();

    component.cities = [
      {
        id: 'city-1',
        name: 'Savannah',
        slug: 'savannah-ga',
        countryCode: 'US',
        adminArea: 'GA',
        description: 'Coastal city',
        imageUrl: '',
        coordinates: { lat: 32.0809, lng: -81.0912 },
        population: 1,
        timezone: 'America/New_York',
        highlights: [],
        communities: 1,
      },
    ];

    component.ngOnChanges({
      cities: {
        previousValue: [],
        currentValue: component.cities,
        firstChange: false,
        isFirstChange: () => false,
      },
    });

    expect(mockLeafletTileLayer.addTo).toHaveBeenCalledWith(mockLeafletMap);
  });

  it('gives locality markers accessible names and keyboard activation', () => {
    const markerElement = document.createElement('div');
    const addedMarkers: Array<{ options: any; marker: any }> = [];
    const leaflet = {
      divIcon: jest.fn((options) => options),
      marker: jest.fn((_coordinates: [number, number], options: any) => {
        const marker = {
          addTo: jest.fn(),
          bindTooltip: jest.fn(),
          getElement: jest.fn(() => markerElement),
          on: jest.fn(),
          remove: jest.fn(),
        };
        marker.addTo.mockReturnValue(marker);
        addedMarkers.push({ options, marker });
        return marker;
      }),
      latLngBounds: jest.fn(() => ({ pad: jest.fn() })),
    };
    const city = {
      id: 'city-1',
      name: 'Savannah',
      slug: 'savannah-ga',
      countryCode: 'US',
      adminArea: 'GA',
      description: 'Coastal city',
      imageUrl: '',
      coordinates: { lat: 32.0809, lng: -81.0912 },
      population: 1,
      timezone: 'America/New_York',
      highlights: [],
      communities: 1,
    };

    (component as any).leaflet = leaflet;
    (component as any).map = {
      fitBounds: jest.fn(),
      setView: jest.fn(),
      invalidateSize: jest.fn(),
    };
    (component as any).tileLayer = { addTo: jest.fn() };
    component.mode = 'atlas-nearby';
    component.cities = [city];

    (component as any).refreshMapContent();

    const localityMarker = addedMarkers.find(({ options }) =>
      options.icon.className.includes('map-marker--locality')
    );
    expect(localityMarker).toBeDefined();
    expect(localityMarker?.options.title).toBe('Savannah');
    expect(localityMarker?.options.alt).toBe('Savannah');
    expect(markerElement.getAttribute('role')).toBe('button');
    expect(markerElement.getAttribute('aria-label')).toBe('Savannah');
    expect(markerElement.getAttribute('tabindex')).toBe('0');

    const eventNames = localityMarker?.marker.on.mock.calls.map(
      ([eventName]: [string]) => eventName
    );
    expect(eventNames).toContain('keydown');

    const keydownBinding = localityMarker?.marker.on.mock.calls.find(
      ([eventName]: [string]) => eventName === 'keydown'
    );
    const preventDefault = jest.fn();
    const citySelected = jest.spyOn(component.citySelected, 'emit');
    keydownBinding?.[1]({
      originalEvent: { key: 'Enter', preventDefault },
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(citySelected).toHaveBeenCalledWith(city);

    citySelected.mockClear();
    const spacePreventDefault = jest.fn();
    keydownBinding?.[1]({
      originalEvent: { key: ' ', preventDefault: spacePreventDefault },
    });

    expect(spacePreventDefault).toHaveBeenCalled();
    expect(citySelected).toHaveBeenCalledWith(city);
  });

  it('gives map controls and legend an accessible structure', () => {
    const control = fixture.nativeElement.querySelector(
      '.map-control-btn'
    ) as HTMLButtonElement;
    const legend = fixture.nativeElement.querySelector(
      '.map-legend'
    ) as HTMLElement;

    expect(control.getAttribute('aria-label')).toBe('Reset map view');
    expect(legend.getAttribute('role')).toBe('group');
    expect(legend.getAttribute('aria-label')).toBe('Map legend');
  });
});
