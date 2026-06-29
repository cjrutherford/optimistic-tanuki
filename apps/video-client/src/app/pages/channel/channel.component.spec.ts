import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ChannelComponent } from './channel.component';
import { VideoService } from '../../services/video.service';

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

    await TestBed.configureTestingModule({
      imports: [ChannelComponent],
      providers: [
        {
          provide: VideoService,
          useValue: videoServiceSpy,
        },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ slugOrId: 'ot-live' })),
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
});
