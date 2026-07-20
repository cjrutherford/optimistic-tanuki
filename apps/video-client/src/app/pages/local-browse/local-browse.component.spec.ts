import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { LocalBrowseComponent } from './local-browse.component';
import { LocalityDiscoveryService } from '../../services/locality-discovery.service';
import { VideoService } from '../../services/video.service';

describe('LocalBrowseComponent', () => {
  let fixture: ComponentFixture<LocalBrowseComponent>;
  let component: LocalBrowseComponent;
  let localityDiscoveryService: jest.Mocked<LocalityDiscoveryService>;
  let videoService: jest.Mocked<VideoService>;

  beforeEach(async () => {
    const localityDiscoveryServiceSpy = {
      discoverNearby: jest.fn(),
    };
    const videoServiceSpy = {
      getChannelFeed: jest.fn(),
      getChannelSchedule: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LocalBrowseComponent],
      providers: [
        provideRouter([]),
        {
          provide: LocalityDiscoveryService,
          useValue: localityDiscoveryServiceSpy,
        },
        {
          provide: VideoService,
          useValue: videoServiceSpy,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LocalBrowseComponent);
    component = fixture.componentInstance;
    localityDiscoveryService = TestBed.inject(
      LocalityDiscoveryService
    ) as jest.Mocked<LocalityDiscoveryService>;
    videoService = TestBed.inject(VideoService) as jest.Mocked<VideoService>;
  });

  it('builds on now and upcoming rails from nearby channel feed and schedule data', async () => {
    const now = Date.now();
    localityDiscoveryService.discoverNearby.mockReturnValue(
      of({
        anchor: { lat: 32.0809, lng: -81.0912 },
        radiusMeters: 40234,
        locality: {
          formatted: 'Savannah, GA, US',
          timezone: 'America/New_York',
        },
        communities: [],
        businesses: [],
        channels: [
          {
            id: 'channel-1',
            communityId: 'community-1',
            communitySlug: 'savannah-signal',
            name: 'Savannah Signal',
            description: 'Local updates.',
            distanceMeters: 1200,
            coordinates: { lat: 32.081, lng: -81.09 },
          },
          {
            id: 'channel-2',
            communityId: 'community-2',
            communitySlug: 'riverfront-live',
            name: 'Riverfront Live',
            description: 'Events and concerts.',
            distanceMeters: 2400,
            coordinates: { lat: 32.09, lng: -81.08 },
          },
        ],
      } as any)
    );
    videoService.getChannelFeed
      .mockReturnValueOnce(
        of({
          id: 'feed-1',
          channelId: 'channel-1',
          communityId: 'community-1',
          timezone: 'America/New_York',
          currentMode: 'live',
          lastTransitionAt: new Date(now - 5 * 60 * 1000),
        } as any)
      )
      .mockReturnValueOnce(
        of({
          id: 'feed-2',
          channelId: 'channel-2',
          communityId: 'community-2',
          timezone: 'America/New_York',
          currentMode: 'scheduled',
          activeProgramBlockId: 'block-now',
          lastTransitionAt: new Date(now - 10 * 60 * 1000),
        } as any)
      );
    videoService.getChannelSchedule
      .mockReturnValueOnce(
        of([
          {
            id: 'block-next-live',
            channelId: 'channel-1',
            communityId: 'community-1',
            title: 'Night Update',
            blockType: 'prerecorded',
            status: 'scheduled',
            startsAt: new Date(now + 30 * 60 * 1000),
            endsAt: new Date(now + 60 * 60 * 1000),
          },
        ] as any)
      )
      .mockReturnValueOnce(
        of([
          {
            id: 'block-now',
            channelId: 'channel-2',
            communityId: 'community-2',
            title: 'Riverfront Soundcheck',
            blockType: 'live_window',
            status: 'scheduled',
            startsAt: new Date(now - 10 * 60 * 1000),
            endsAt: new Date(now + 20 * 60 * 1000),
          },
          {
            id: 'block-next',
            channelId: 'channel-2',
            communityId: 'community-2',
            title: 'Late Concert',
            blockType: 'live_window',
            status: 'scheduled',
            startsAt: new Date(now + 90 * 60 * 1000),
            endsAt: new Date(now + 120 * 60 * 1000),
          },
        ] as any)
      );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.nearbyChannels).toHaveLength(2);
    expect(component.onNowPrograms).toHaveLength(2);
    expect(component.onNowPrograms[0].queryParams).toEqual({
      tab: 'feed',
      mode: 'live',
    });
    expect(component.onNowPrograms[1].queryParams).toEqual({
      tab: 'schedule',
      block: 'block-now',
    });
    expect(component.upcomingPrograms).toHaveLength(2);
    expect(component.upcomingPrograms[0].block?.id).toBe('block-next-live');
    expect(component.upcomingPrograms[1].block?.id).toBe('block-next');
    expect(fixture.nativeElement.textContent).toContain('On Now');
    expect(fixture.nativeElement.textContent).toContain('Upcoming');
    expect(fixture.nativeElement.textContent).toContain('Local Channels');
  });

  it('treats replay continuity as on-now tuner programming', async () => {
    localityDiscoveryService.discoverNearby.mockReturnValue(
      of({
        anchor: { lat: 32.0809, lng: -81.0912 },
        radiusMeters: 40234,
        locality: {
          formatted: 'Savannah, GA, US',
          timezone: 'America/New_York',
        },
        communities: [],
        businesses: [],
        channels: [
          {
            id: 'channel-1',
            communityId: 'community-1',
            communitySlug: 'savannah-signal',
            name: 'Savannah Signal',
            description: 'Local updates.',
            distanceMeters: 1200,
            coordinates: { lat: 32.081, lng: -81.09 },
          },
        ],
      } as any)
    );
    videoService.getChannelFeed.mockReturnValue(
      of({
        id: 'feed-1',
        channelId: 'channel-1',
        communityId: 'community-1',
        timezone: 'America/New_York',
        currentMode: 'replay',
        activeProgramBlockId: 'block-replay',
        activeVideoId: 'video-1',
        lastTransitionAt: new Date(),
      } as any)
    );
    videoService.getChannelSchedule.mockReturnValue(
      of([
        {
          id: 'block-replay',
          channelId: 'channel-1',
          communityId: 'community-1',
          title: 'Morning replay',
          blockType: 'prerecorded',
          status: 'completed',
          startsAt: new Date(Date.now() - 7200000),
          endsAt: new Date(Date.now() - 3600000),
        },
      ] as any)
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.onNowPrograms).toHaveLength(1);
    expect(component.onNowPrograms[0].mode).toBe('replay');
    expect(component.onNowPrograms[0].queryParams).toEqual({
      tab: 'feed',
      mode: 'replay',
      block: 'block-replay',
    });
  });
});
