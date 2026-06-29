import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LandingComponent } from './landing.component';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CommunityService } from '../../services/community.service';
import { PaymentService } from '../../services/payment.service';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { LocalityDiscoveryService } from '../../services/locality-discovery.service';
import { of } from 'rxjs';

const donationGoalMock = {
  monthlyGoal: 5000,
  currentAmount: 1200,
  donorCount: 14,
};

const paymentServiceMock = {
  getDonationGoal: jest.fn().mockResolvedValue(donationGoalMock),
};

const localityDiscoveryServiceMock = {
  discoverNearby: jest.fn().mockReturnValue(
    of({
      anchor: { lat: 32.08, lng: -81.09 },
      radiusMeters: 16093,
      locality: {
        primary: 'Savannah',
        formatted: 'Savannah, GA, US',
        source: 'coordinates',
      },
      communities: [],
      businesses: [
        {
          id: 'business-1',
          communityId: 'community-1',
          name: 'Local Market',
          description: 'Neighborhood grocery and deli.',
          distanceMeters: 1200,
          coordinates: { lat: 32.08, lng: -81.09 },
        },
      ],
      channels: [
        {
          id: 'channel-1',
          communityId: 'community-1',
          name: 'Downtown Live',
          description: 'Neighborhood stream updates.',
          distanceMeters: 1800,
          coordinates: { lat: 32.09, lng: -81.1 },
        },
      ],
    })
  ),
};

describe('LandingComponent', () => {
  let component: LandingComponent;
  let fixture: ComponentFixture<LandingComponent>;
  let communityService: CommunityService;

  async function renderComponent(): Promise<void> {
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    Object.defineProperty(global.navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: jest.fn((success) =>
          success({
            coords: {
              latitude: 32.08,
              longitude: -81.09,
            },
          })
        ),
      },
    });

    await TestBed.configureTestingModule({
      imports: [LandingComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [
        CommunityService,
        { provide: PaymentService, useValue: paymentServiceMock },
        {
          provide: LocalityDiscoveryService,
          useValue: localityDiscoveryServiceMock,
        },
        { provide: API_BASE_URL, useValue: '' },
      ],
    }).compileComponents();

    communityService = TestBed.inject(CommunityService);
    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create', async () => {
    jest.spyOn(communityService, 'getCommunities').mockResolvedValue([]);

    await renderComponent();

    expect(component).toBeTruthy();
  });

  it('loads API cities in alphabetical order', async () => {
    jest.spyOn(communityService, 'getCommunities').mockResolvedValue([
      {
        id: '2',
        name: 'Savannah, GA',
        slug: 'savannah-ga',
        description: 'Savannah community',
        localityType: 'city',
        countryCode: 'US',
        adminArea: 'GA',
        city: 'Savannah',
        memberCount: 10,
        createdAt: '2024-01-01T00:00:00.000Z',
        lat: 32.08,
        lng: -81.09,
        population: 147088,
        imageUrl: 'https://example.com/savannah.jpg',
        timezone: 'America/New_York',
      },
      {
        id: '1',
        name: 'Atlanta, GA',
        slug: 'atlanta-ga',
        description: 'Atlanta community',
        localityType: 'city',
        countryCode: 'US',
        adminArea: 'GA',
        city: 'Atlanta',
        memberCount: 10,
        createdAt: '2024-01-01T00:00:00.000Z',
        lat: 33.74,
        lng: -84.38,
        population: 496441,
        imageUrl: 'https://example.com/atlanta.jpg',
        timezone: 'America/New_York',
      },
      {
        id: '3',
        name: 'Starland Makers',
        slug: 'starland-makers',
        description: 'Neighborhood group',
        localityType: 'neighborhood',
        countryCode: 'US',
        adminArea: 'GA',
        city: 'Savannah',
        memberCount: 8,
        createdAt: '2024-01-01T00:00:00.000Z',
        imageUrl: 'https://example.com/starland.jpg',
      },
      {
        id: '4',
        name: 'Augusta, GA',
        slug: 'augusta-ga',
        description: 'Augusta community',
        localityType: 'city',
        countryCode: 'US',
        adminArea: 'GA',
        city: 'Augusta',
        memberCount: 10,
        createdAt: '2024-01-01T00:00:00.000Z',
        lat: 33.44,
        lng: -81.96,
        population: 197166,
        imageUrl: 'https://example.com/augusta.jpg',
        timezone: 'America/New_York',
      },
    ]);

    await renderComponent();

    expect(component.cities().map((city) => city.name)).toEqual([
      'Atlanta',
      'Augusta',
      'Savannah',
    ]);
  });

  it('advances the city carousel one page at a time', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1024,
      writable: true,
    });

    jest.spyOn(communityService, 'getCommunities').mockResolvedValue([
      {
        id: '1',
        name: 'Atlanta, GA',
        slug: 'atlanta-ga',
        description: 'Atlanta community',
        localityType: 'city',
        countryCode: 'US',
        adminArea: 'GA',
        city: 'Atlanta',
        memberCount: 10,
        createdAt: '2024-01-01T00:00:00.000Z',
        imageUrl: 'https://example.com/atlanta.jpg',
      },
      {
        id: '2',
        name: 'Savannah, GA',
        slug: 'savannah-ga',
        description: 'Savannah community',
        localityType: 'city',
        countryCode: 'US',
        adminArea: 'GA',
        city: 'Savannah',
        memberCount: 10,
        createdAt: '2024-01-01T00:00:00.000Z',
        imageUrl: 'https://example.com/savannah.jpg',
      },
      {
        id: '3',
        name: 'Augusta, GA',
        slug: 'augusta-ga',
        description: 'Augusta community',
        localityType: 'city',
        countryCode: 'US',
        adminArea: 'GA',
        city: 'Augusta',
        memberCount: 10,
        createdAt: '2024-01-01T00:00:00.000Z',
        imageUrl: 'https://example.com/augusta.jpg',
      },
    ]);

    await renderComponent();

    expect(component.visibleCities.map((city) => city.name)).toEqual([
      'Atlanta',
      'Augusta',
    ]);

    component.scrollCities('next');

    expect(component.visibleCities.map((city) => city.name)).toEqual([
      'Augusta',
      'Savannah',
    ]);
    expect(component.canScrollCitiesForward).toBe(false);
    expect(component.canScrollCitiesBackward).toBe(true);
  });

  it('renders a how-it-works band for the public landing page', async () => {
    jest.spyOn(communityService, 'getCommunities').mockResolvedValue([]);

    await renderComponent();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('How Towne Square works');
  });

  it('renders nearby discovery cards when browser location is available', async () => {
    jest.spyOn(communityService, 'getCommunities').mockResolvedValue([]);

    await renderComponent();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(localityDiscoveryServiceMock.discoverNearby).toHaveBeenCalled();
    expect(compiled.textContent).toContain('Nearby right now');
    expect(compiled.textContent).toContain('Local Market');
    expect(compiled.textContent).toContain('Downtown Live');
  });
});
