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
  ]),
  getCitiesFromCommunities: jest.fn().mockReturnValue([
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

    const mapComponent = fixture.debugElement.query(
      By.directive(MapComponent)
    )?.componentInstance as MapComponent | undefined;

    expect(mapComponent).toBeDefined();
    expect(mapComponent?.mode).toBe('atlas-nearby');
  });
});
