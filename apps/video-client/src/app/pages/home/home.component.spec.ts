import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { HomeComponent } from './home.component';
import { VideoService } from '../../services/video.service';
import { LocalityDiscoveryService } from '../../services/locality-discovery.service';
import { AppRegistryService } from '@optimistic-tanuki/app-registry';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let component: HomeComponent;
  let videoService: jest.Mocked<VideoService>;
  let localityDiscoveryService: jest.Mocked<LocalityDiscoveryService>;
  let appRegistryService: jest.Mocked<AppRegistryService>;

  beforeEach(async () => {
    const videoServiceSpy = {
      getRecommendedVideos: jest.fn(),
      getTrendingVideos: jest.fn(),
    };
    const localityDiscoveryServiceSpy = {
      discoverNearby: jest.fn(),
    };
    const appRegistryServiceSpy = {
      getApp: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        {
          provide: VideoService,
          useValue: videoServiceSpy,
        },
        {
          provide: LocalityDiscoveryService,
          useValue: localityDiscoveryServiceSpy,
        },
        {
          provide: AppRegistryService,
          useValue: appRegistryServiceSpy,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    videoService = TestBed.inject(VideoService) as jest.Mocked<VideoService>;
    localityDiscoveryService = TestBed.inject(
      LocalityDiscoveryService
    ) as jest.Mocked<LocalityDiscoveryService>;
    appRegistryService = TestBed.inject(
      AppRegistryService
    ) as jest.Mocked<AppRegistryService>;
  });

  it('loads nearby locality discovery for the home page and renders channel cards', async () => {
    videoService.getRecommendedVideos.mockReturnValue(of([]));
    videoService.getTrendingVideos.mockReturnValue(of([]));
    appRegistryService.getApp.mockReturnValue(
      of({
        appId: 'business-site',
        name: 'Business Site',
        domain: 'business.local',
        uiBaseUrl: 'http://localhost:8094',
        apiBaseUrl: 'http://localhost:8094/api',
        appType: 'client',
        visibility: 'public',
      } as any)
    );
    localityDiscoveryService.discoverNearby.mockReturnValue(
      of({
        anchor: { lat: 32.0809, lng: -81.0912 },
        radiusMeters: 40234,
        locality: {
          primary: 'Savannah',
          formatted: 'Savannah, GA, US',
          timezone: 'America/New_York',
          source: 'community-metadata',
        },
        communities: [
          {
            id: 'community-1',
            name: 'Savannah',
            distanceMeters: 0,
            coordinates: { lat: 32.0809, lng: -81.0912 },
          },
        ],
        businesses: [
          {
            id: 'business-1',
            communityId: 'community-1',
            name: 'North Star Advisory',
            siteSlug: 'north-star-advisory',
            sitePath: '/sites/north-star-advisory',
            distanceMeters: 1200,
            coordinates: { lat: 32.081, lng: -81.09 },
          },
        ],
        channels: [
          {
            id: 'channel-1',
            communityId: 'community-1',
            communitySlug: 'savannah-ga',
            name: 'Savannah Signal',
            description: 'Local updates and replays.',
            distanceMeters: 1200,
            coordinates: { lat: 32.081, lng: -81.09 },
          },
        ],
      } as any)
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(localityDiscoveryService.discoverNearby).toHaveBeenCalledWith(
      {
        anchor: { lat: 32.0809, lng: -81.0912 },
        radiusMeters: 40234,
      },
      { scope: 'local-hub', limit: 6 }
    );
    expect(component.localityLabel).toBe('Savannah, GA, US');
    expect(fixture.nativeElement.textContent).toContain('Nearby Channels');
    expect(fixture.nativeElement.textContent).toContain('Savannah Signal');
    expect(fixture.nativeElement.textContent).toContain('Nearby Businesses');
    const businessLink = fixture.nativeElement.querySelector(
      '[data-testid="nearby-business-link"]'
    ) as HTMLAnchorElement | null;
    expect(businessLink?.href).toBe(
      'http://localhost:8094/sites/north-star-advisory'
    );
  });
});
