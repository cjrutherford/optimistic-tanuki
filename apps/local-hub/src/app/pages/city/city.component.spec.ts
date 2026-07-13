import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { CityComponent } from './city.component';
import { CommunityService } from '../../services/community.service';
import { AuthStateService } from '../../services/auth-state.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { PaymentService } from '../../services/payment.service';
import { LocalityInfoService } from '../../services/locality-info.service';
import { BusinessApiService } from '@optimistic-tanuki/business-data-access';
import { AppRegistryService } from '@optimistic-tanuki/app-registry';
import { LocalityDiscoveryService } from '../../services/locality-discovery.service';
import {
  ClassifiedService,
  ClassifiedAdDto,
} from '@optimistic-tanuki/classified-ui';
import { MapComponent } from '../../components/map/map.component';

const communityServiceMock = {
  getLocalityBySlug: jest.fn().mockResolvedValue({
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
  }),
  getCommunitiesForCity: jest.fn().mockResolvedValue([
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
  getPostsForRootCommunity: jest.fn().mockResolvedValue([]),
  getCommunityManager: jest.fn().mockResolvedValue(null),
  getActiveElection: jest.fn().mockResolvedValue(null),
};

const authStateMock = {
  isAuthenticated$: { pipe: () => ({ subscribe: jest.fn() }) },
  isAuthenticated: false,
};

const paymentServiceMock = {
  getEligibleOnPageCampaigns: jest.fn().mockResolvedValue([]),
  getCityBusinesses: jest.fn().mockResolvedValue([
    {
      id: 'business-1',
      userId: 'owner-1',
      communityId: 'city-1',
      name: 'North Star Advisory',
      description: 'Planning and advisory support.',
      tier: 'pro',
      status: 'active',
      locations: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]),
  getDonationGoal: jest.fn().mockResolvedValue({
    raised: 0,
    goal: 0,
    donorCount: 0,
  }),
};

const classifiedServiceMock = {
  findByCommunity: jest
    .fn()
    .mockResolvedValue({ data: [] as ClassifiedAdDto[] }),
};

const localityInfoServiceMock = {
  enrichLocality: jest.fn().mockImplementation(async (locality) => ({
    ...locality,
    description: 'Savannah is a coastal Georgia city.',
    imageUrl: 'https://upload.wikimedia.org/savannah.jpg',
    externalInfo: {
      source: 'api',
      articleUrl: 'https://en.wikipedia.org/wiki/Savannah,_Georgia',
    },
  })),
};

const businessApiServiceMock = {
  listPublishedSites: jest.fn().mockReturnValue(
    of([
      {
        slug: 'north-star-advisory',
        businessName: 'North Star Advisory',
        tagline: 'Steady planning for local operators.',
        location: 'Savannah, GA',
        businessType: 'consulting',
      },
    ])
  ),
};

const appRegistryServiceMock = {
  getApp: jest.fn().mockImplementation((appId: string) =>
    of(
      appId === 'video-client'
        ? {
            appId: 'video-client',
            name: 'MetroCast',
            domain: 'metrocast.local',
            uiBaseUrl: 'http://localhost:8093',
            apiBaseUrl: 'http://localhost:8093/api',
            appType: 'client',
            visibility: 'public',
          }
        : {
            appId: 'business-site',
            name: 'Business Site',
            domain: 'business.local',
            uiBaseUrl: 'http://localhost:8094',
            apiBaseUrl: 'http://localhost:8094/api',
            appType: 'client',
            visibility: 'public',
          }
    )
  ),
};

const localityDiscoveryServiceMock = {
  discoverNearby: jest.fn().mockReturnValue(
    of({
      businesses: [
        {
          id: 'business-1',
          name: 'North Star Advisory',
          sitePath: '/sites/north-star-advisory',
          distanceMeters: 1200,
        },
      ],
      channels: [
        {
          id: 'channel-1',
          name: 'Savannah Signal',
          communitySlug: 'savannah-signal',
          description: 'Local updates and replays.',
          distanceMeters: 900,
        },
      ],
    })
  ),
};

describe('CityComponent', () => {
  let fixture: ComponentFixture<CityComponent>;
  let router: Router;
  const geolocation = {
    getCurrentPosition: jest.fn(),
  };

  beforeEach(async () => {
    geolocation.getCurrentPosition.mockImplementation((success) => {
      success({
        coords: {
          latitude: 32.05,
          longitude: -81.1,
        },
      });
    });
    Object.defineProperty(global.navigator, 'geolocation', {
      configurable: true,
      value: geolocation,
    });

    await TestBed.configureTestingModule({
      imports: [CityComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: CommunityService, useValue: communityServiceMock },
        { provide: AuthStateService, useValue: authStateMock },
        { provide: MessageService, useValue: { addMessage: jest.fn() } },
        { provide: PaymentService, useValue: paymentServiceMock },
        { provide: BusinessApiService, useValue: businessApiServiceMock },
        { provide: AppRegistryService, useValue: appRegistryServiceMock },
        {
          provide: LocalityDiscoveryService,
          useValue: localityDiscoveryServiceMock,
        },
        { provide: ClassifiedService, useValue: classifiedServiceMock },
        { provide: LocalityInfoService, useValue: localityInfoServiceMock },
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'savannah-ga' } } },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(CityComponent);
    fixture.detectChanges();
  });

  it('uses single-location mode for the city detail map', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    const mapComponent = fixture.debugElement.query(By.directive(MapComponent))
      ?.componentInstance as MapComponent | undefined;

    expect(mapComponent).toBeDefined();
    expect(mapComponent?.mode).toBe('single-location');
  });

  it('passes browser geolocation to the city detail map', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    const mapComponent = fixture.debugElement.query(By.directive(MapComponent))
      ?.componentInstance as MapComponent | undefined;

    expect(mapComponent?.userLocation).toEqual({ lat: 32.05, lng: -81.1 });
  });

  it('returns to the locality index through locality-first routes', async () => {
    await fixture.whenStable();
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const component = fixture.componentInstance;

    component.navigateToCities();

    expect(navigateSpy).toHaveBeenCalledWith(['/localities']);
  });

  it('enriches the locality detail with API-backed city information', async () => {
    await fixture.whenStable();

    expect(localityInfoServiceMock.enrichLocality).toHaveBeenCalled();
    expect(fixture.componentInstance.city()).toMatchObject({
      description: 'Savannah is a coastal Georgia city.',
      imageUrl: 'https://upload.wikimedia.org/savannah.jpg',
      externalInfo: {
        source: 'api',
      },
    });
  });

  it('prefers the hosted business-site link when a published site matches', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      '[data-testid="city-business-link"]'
    ) as HTMLAnchorElement | null;

    expect(link?.textContent).toContain('Visit Business Site');
    expect(link?.href).toBe('http://localhost:8094/sites/north-star-advisory');
  });

  it('renders the local network hub with MetroCast and Studio destinations', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    expect(localityDiscoveryServiceMock.discoverNearby).toHaveBeenCalledWith(
      {
        anchor: { lat: 32.0809, lng: -81.0912 },
        radiusMeters: 40234,
      },
      { scope: 'local-hub', limit: 3 }
    );
    expect(fixture.nativeElement.textContent).toContain('Local Network');
    expect(fixture.nativeElement.textContent).toContain('Savannah Signal');
    const channelLink = fixture.nativeElement.querySelector(
      '[data-testid="locality-network-channel-link"]'
    ) as HTMLAnchorElement | null;
    expect(channelLink?.href).toBe('http://localhost:8093/c/savannah-signal');
    const businessLink = fixture.nativeElement.querySelector(
      '[data-testid="locality-network-business-link"]'
    ) as HTMLAnchorElement | null;
    expect(businessLink?.href).toBe(
      'http://localhost:8094/sites/north-star-advisory'
    );
  });
});
