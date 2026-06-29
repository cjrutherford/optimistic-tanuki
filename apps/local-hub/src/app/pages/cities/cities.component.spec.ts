import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import { CitiesComponent } from './cities.component';
import { CommunityService } from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';
import { MapComponent } from '../../components/map/map.component';
import { PLATFORM_ID } from '@angular/core';

const communityServiceMock = {
  getCommunities: jest.fn().mockResolvedValue([
    {
      id: 'city-1',
      name: 'Savannah',
      slug: 'savannah-ga',
      localityType: 'city',
      city: 'Savannah',
      adminArea: 'GA',
      countryCode: 'US',
      description: 'Coastal city',
      memberCount: 1,
      createdAt: new Date().toISOString(),
      coordinates: { lat: 32.0809, lng: -81.0912 },
    },
    {
      id: 'city-2',
      name: 'Augusta',
      slug: 'augusta-ga',
      localityType: 'city',
      city: 'Augusta',
      adminArea: 'GA',
      countryCode: 'US',
      description: 'River city',
      memberCount: 1,
      createdAt: new Date().toISOString(),
      coordinates: { lat: 33.4735, lng: -82.0105 },
    },
  ]),
  getLocalitiesFromCommunities: jest.fn().mockReturnValue([
    {
      id: 'city-1',
      name: 'Savannah',
      slug: 'savannah-ga',
      localityType: 'city',
      countryCode: 'US',
      adminArea: 'GA',
      description: 'Coastal city',
      imageUrl: '',
      coordinates: { lat: 32.0809, lng: -81.0912 },
      label: {
        primary: 'Savannah',
        formatted: 'Savannah, GA, US',
        source: 'community-metadata',
      },
      scope: {
        anchor: { lat: 32.0809, lng: -81.0912 },
        radiusMeters: 40234,
      },
      population: 1,
      timezone: 'America/New_York',
      highlights: [],
      communities: 1,
    },
    {
      id: 'city-2',
      name: 'Augusta',
      slug: 'augusta-ga',
      localityType: 'city',
      countryCode: 'US',
      adminArea: 'GA',
      description: 'River city',
      imageUrl: '',
      coordinates: { lat: 33.4735, lng: -82.0105 },
      label: {
        primary: 'Augusta',
        formatted: 'Augusta, GA, US',
        source: 'community-metadata',
      },
      scope: {
        anchor: { lat: 33.4735, lng: -82.0105 },
        radiusMeters: 40234,
      },
      population: 1,
      timezone: 'America/New_York',
      highlights: [],
      communities: 1,
    },
  ]),
  getMyMemberships: jest.fn().mockResolvedValue([]),
};

const authStateMock = {
  isAuthenticated: false,
};

describe('CitiesComponent', () => {
  let component: CitiesComponent;
  let fixture: ComponentFixture<CitiesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CitiesComponent, RouterTestingModule],
      providers: [
        { provide: CommunityService, useValue: communityServiceMock },
        { provide: AuthStateService, useValue: authStateMock },
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CitiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('uses atlas-nearby mode for the cities map', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    const mapComponent = fixture.debugElement.query(By.directive(MapComponent))
      ?.componentInstance as MapComponent | undefined;

    expect(mapComponent).toBeDefined();
    expect(mapComponent?.mode).toBe('atlas-nearby');
  });

  it('prioritizes nearby localities when a user anchor is available', async () => {
    await fixture.whenStable();

    component.userLocation.set({ lat: 32.081, lng: -81.091 });

    expect(component.filteredCities().map((city) => city.slug)).toEqual([
      'savannah-ga',
      'augusta-ga',
    ]);
  });
});
