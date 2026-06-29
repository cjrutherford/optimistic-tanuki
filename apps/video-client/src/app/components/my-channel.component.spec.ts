import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MyChannelComponent } from './my-channel.component';
import { VideoService } from '../services/video.service';
import { ProfileService } from '../services/profile.service';
import { LocalityDiscoveryService } from '../services/locality-discovery.service';

describe('MyChannelComponent', () => {
  let fixture: ComponentFixture<MyChannelComponent>;
  let component: MyChannelComponent;
  let videoService: jest.Mocked<VideoService>;
  let profileService: jest.Mocked<ProfileService>;
  let localityDiscoveryService: jest.Mocked<LocalityDiscoveryService>;

  beforeEach(async () => {
    const videoServiceSpy = {
      getUserChannels: jest.fn(),
      getChannelVideos: jest.fn(),
      getChannelFeed: jest.fn(),
      getChannelSchedule: jest.fn(),
      updateChannel: jest.fn(),
    };
    const profileServiceSpy = {
      getCurrentUserProfile: jest.fn(),
    };
    const localityDiscoveryServiceSpy = {
      discoverNearby: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [MyChannelComponent],
      providers: [
        provideRouter([]),
        {
          provide: VideoService,
          useValue: videoServiceSpy,
        },
        {
          provide: ProfileService,
          useValue: profileServiceSpy,
        },
        {
          provide: LocalityDiscoveryService,
          useValue: localityDiscoveryServiceSpy,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MyChannelComponent);
    component = fixture.componentInstance;
    videoService = TestBed.inject(VideoService) as jest.Mocked<VideoService>;
    profileService = TestBed.inject(
      ProfileService
    ) as jest.Mocked<ProfileService>;
    localityDiscoveryService = TestBed.inject(
      LocalityDiscoveryService
    ) as jest.Mocked<LocalityDiscoveryService>;
  });

  it('loads locality discovery for the current channel anchor and saves updated anchors', async () => {
    profileService.getCurrentUserProfile.mockReturnValue({
      id: 'profile-1',
      userId: 'user-1',
      profileName: 'Savannah Signal',
    } as any);
    videoService.getUserChannels.mockReturnValue(
      of([
        {
          id: 'channel-1',
          name: 'Savannah Signal',
          profileId: 'profile-1',
          userId: 'user-1',
          communityId: 'community-1',
          communitySlug: 'savannah-signal',
          anchorLat: 32.0809,
          anchorLng: -81.0912,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ])
    );
    videoService.getChannelVideos.mockResolvedValue([]);
    videoService.getChannelFeed.mockReturnValue(
      of({
        id: 'feed-1',
        channelId: 'channel-1',
        communityId: 'community-1',
        timezone: 'America/New_York',
        currentMode: 'scheduled',
        lastTransitionAt: new Date(),
      } as any)
    );
    videoService.getChannelSchedule.mockReturnValue(of([]));
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
        communities: [],
        businesses: [
          {
            id: 'business-1',
            communityId: 'community-1',
            name: 'Riverfront Coffee',
            distanceMeters: 800,
            coordinates: { lat: 32.08, lng: -81.09 },
          },
        ],
        channels: [
          {
            id: 'channel-2',
            communityId: 'community-1',
            communitySlug: 'savannah-live',
            name: 'Savannah Live',
            distanceMeters: 1200,
            coordinates: { lat: 32.081, lng: -81.09 },
          },
        ],
      } as any)
    );
    videoService.updateChannel.mockResolvedValue({
      id: 'channel-1',
      name: 'Savannah Signal',
      profileId: 'profile-1',
      userId: 'user-1',
      communityId: 'community-1',
      communitySlug: 'savannah-signal',
      anchorLat: 32.09,
      anchorLng: -81.1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    fixture.detectChanges();
    await fixture.whenStable();
    component.activeTab = 'locality';
    fixture.detectChanges();

    expect(localityDiscoveryService.discoverNearby).toHaveBeenCalledWith(
      {
        anchor: { lat: 32.0809, lng: -81.0912 },
        radiusMeters: 40234,
      },
      { scope: 'metrocast', limit: 6 }
    );
    expect(fixture.nativeElement.textContent).toContain('Savannah, GA, US');
    expect(fixture.nativeElement.textContent).toContain('Savannah Live');

    component.localityForm.anchorLat = '32.09';
    component.localityForm.anchorLng = '-81.1';
    await component.saveLocality();
    fixture.detectChanges();

    expect(videoService.updateChannel).toHaveBeenCalledWith('channel-1', {
      anchorLat: 32.09,
      anchorLng: -81.1,
      timezone: 'America/New_York',
    });
    expect(component.channel?.anchorLat).toBe(32.09);
    expect(component.localityMessage).toContain('saved');
  });
});
