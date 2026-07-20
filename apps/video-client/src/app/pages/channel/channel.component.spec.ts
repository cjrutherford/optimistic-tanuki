import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ChannelComponent } from './channel.component';
import { VideoService } from '../../services/video.service';
import { SponsorDiscoveryService } from '../../services/sponsor-discovery.service';

describe('ChannelComponent', () => {
  let fixture: ComponentFixture<ChannelComponent>;
  let component: ChannelComponent;
  let videoService: jest.Mocked<VideoService>;

  beforeEach(async () => {
    const videoServiceSpy = {
      getChannel: jest.fn(),
      getChannelVideos: jest.fn(),
      getChannelFeed: jest.fn(),
      getChannelSchedule: jest.fn(),
    };
    const sponsorDiscoveryServiceSpy = {
      discoverOnPage: jest.fn(() => of([])),
    };

    await TestBed.configureTestingModule({
      imports: [ChannelComponent],
      providers: [
        {
          provide: VideoService,
          useValue: videoServiceSpy,
        },
        {
          provide: SponsorDiscoveryService,
          useValue: sponsorDiscoveryServiceSpy,
        },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ slugOrId: 'ot-live' })),
            queryParamMap: of(
              convertToParamMap({ tab: 'schedule', block: 'block-1' })
            ),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChannelComponent);
    component = fixture.componentInstance;
    videoService = TestBed.inject(VideoService) as jest.Mocked<VideoService>;
  });

  it('loads the channel, active feed, and schedule using the community slug route param', async () => {
    videoService.getChannel.mockReturnValue(
      of({
        id: 'channel-1',
        communityId: 'community-1',
        communitySlug: 'ot-live',
        name: 'OT Live',
        profileId: 'profile-1',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
    );
    videoService.getChannelVideos.mockResolvedValue([]);
    videoService.getChannelFeed.mockReturnValue(
      of({
        id: 'feed-1',
        channelId: 'channel-1',
        communityId: 'community-1',
        timezone: 'America/New_York',
        currentMode: 'live',
        lastTransitionAt: new Date(),
      } as any)
    );
    videoService.getChannelSchedule.mockReturnValue(of([]));

    fixture.detectChanges();
    await fixture.whenStable();

    expect(videoService.getChannel).toHaveBeenCalledWith('ot-live');
    expect(videoService.getChannelFeed).toHaveBeenCalledWith('ot-live');
    expect(videoService.getChannelSchedule).toHaveBeenCalledWith('ot-live');
    expect(component.channel?.communitySlug).toBe('ot-live');
    expect(component.activeTab).toBe('schedule');
    expect(component.highlightedScheduleBlockId).toBe('block-1');
  });

  it('renders locality anchor details on the about tab when the channel has an anchor', async () => {
    videoService.getChannel.mockReturnValue(
      of({
        id: 'channel-1',
        communityId: 'community-1',
        communitySlug: 'ot-live',
        name: 'OT Live',
        profileId: 'profile-1',
        userId: 'user-1',
        anchorLat: 32.0809,
        anchorLng: -81.0912,
        timezone: 'America/New_York',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
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

    fixture.detectChanges();
    await fixture.whenStable();
    component.activeTab = 'about';
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Locality anchor');
    expect(fixture.nativeElement.textContent).toContain('32.0809');
    expect(fixture.nativeElement.textContent).toContain('-81.0912');
    expect(fixture.nativeElement.textContent).toContain('America/New_York');
  });

  it('highlights a scheduled block requested from discovery routing', async () => {
    videoService.getChannel.mockReturnValue(
      of({
        id: 'channel-1',
        communityId: 'community-1',
        communitySlug: 'ot-live',
        name: 'OT Live',
        profileId: 'profile-1',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
    );
    videoService.getChannelVideos.mockResolvedValue([]);
    videoService.getChannelFeed.mockReturnValue(
      of({
        id: 'feed-1',
        channelId: 'channel-1',
        communityId: 'community-1',
        timezone: 'America/New_York',
        currentMode: 'scheduled',
        activeProgramBlockId: 'block-1',
        lastTransitionAt: new Date(),
      } as any)
    );
    videoService.getChannelSchedule.mockReturnValue(
      of([
        {
          id: 'block-1',
          channelId: 'channel-1',
          communityId: 'community-1',
          title: 'City Hall Live',
          blockType: 'live_window',
          status: 'scheduled',
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 3600000),
        },
      ] as any)
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const highlighted = fixture.nativeElement.querySelector(
      '.schedule-card.highlighted'
    );
    expect(highlighted?.textContent).toContain('City Hall Live');
  });

  it('renders replay continuity details on the feed tab', async () => {
    videoService.getChannel.mockReturnValue(
      of({
        id: 'channel-1',
        communityId: 'community-1',
        communitySlug: 'ot-live',
        name: 'OT Live',
        profileId: 'profile-1',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
    );
    videoService.getChannelVideos.mockResolvedValue([]);
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
    component.activeTab = 'feed';
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Replay continuity');
    expect(fixture.nativeElement.textContent).toContain('Morning replay');
  });

  it('uses the persisted playlist decision to link the current program to playback', async () => {
    videoService.getChannel.mockReturnValue(
      of({
        id: 'channel-1',
        communityId: 'community-1',
        communitySlug: 'ot-live',
        name: 'OT Live',
        profileId: 'profile-1',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
    );
    videoService.getChannelVideos.mockResolvedValue([]);
    videoService.getChannelFeed.mockReturnValue(
      of({
        id: 'feed-1',
        channelId: 'channel-1',
        communityId: 'community-1',
        timezone: 'America/New_York',
        currentMode: 'scheduled',
        activeVideoId: 'stale-video-id',
        lastTransitionAt: new Date(),
        activePlaylistItem: {
          kind: 'scheduled',
          reason: 'scheduled-program-is-live',
          videoId: 'current-video-id',
          decidedAt: new Date(),
        },
      } as any)
    );
    videoService.getChannelSchedule.mockReturnValue(of([]));

    fixture.detectChanges();
    await fixture.whenStable();
    component.activeTab = 'feed';
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      '[data-testid="current-playlist-link"]'
    );
    expect(fixture.nativeElement.textContent).toContain('Scheduled program');
    expect(link?.getAttribute('href')).toContain('/watch/current-video-id');
  });

  it('renders live handoff details when the feed exposes an active live session', async () => {
    videoService.getChannel.mockReturnValue(
      of({
        id: 'channel-1',
        communityId: 'community-1',
        communitySlug: 'ot-live',
        name: 'OT Live',
        profileId: 'profile-1',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
    );
    videoService.getChannelVideos.mockResolvedValue([]);
    videoService.getChannelFeed.mockReturnValue(
      of({
        id: 'feed-1',
        channelId: 'channel-1',
        communityId: 'community-1',
        timezone: 'America/New_York',
        currentMode: 'live',
        activeLiveSessionId: 'session-1',
        activeLiveSession: {
          id: 'session-1',
          communityId: 'community-1',
          channelId: 'channel-1',
          title: 'OT Live at City Hall',
          status: 'live',
          startedByUserId: 'user-1',
          startedByProfileId: 'profile-1',
          startedAt: new Date('2026-07-08T18:00:00.000Z'),
        },
        liveHandoff: {
          status: 'ready',
          playbackPath: '/watch/live/ot-live',
          requiresAuth: false,
          tokenContract: 'gateway-token-exchange',
          localityPolicy: 'planned-channel-anchor',
        },
        lastTransitionAt: new Date(),
      } as any)
    );
    videoService.getChannelSchedule.mockReturnValue(of([]));

    fixture.detectChanges();
    await fixture.whenStable();
    component.activeTab = 'feed';
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Live handoff ready');
    expect(fixture.nativeElement.textContent).toContain('OT Live at City Hall');
    expect(fixture.nativeElement.textContent).toContain(
      'gateway-token-exchange'
    );
  });
});
