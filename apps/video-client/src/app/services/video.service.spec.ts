import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { VideoService } from './video.service';
import {
  ChannelFeedDto,
  ChannelDto,
  ProgramBlockDto,
  StartLiveSessionDto,
  UpdateChannelDto,
} from '@optimistic-tanuki/ui-models';

describe('VideoService', () => {
  let service: VideoService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [VideoService],
    });

    service = TestBed.inject(VideoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads the active feed for a community-backed channel route', () => {
    const mockFeed: ChannelFeedDto = {
      id: 'feed-1',
      channelId: 'channel-1',
      communityId: 'community-1',
      timezone: 'America/New_York',
      currentMode: 'scheduled',
      activeProgramBlockId: 'block-1',
      activeLiveSessionId: null,
      activeVideoId: 'video-1',
      lastTransitionAt: new Date('2026-04-17T14:00:00.000Z'),
    };

    service.getChannelFeed('ot-live').subscribe((feed) => {
      expect(feed).toEqual(mockFeed);
    });

    const req = httpMock.expectOne('/api/videos/channels/ot-live/feed');
    expect(req.request.method).toBe('GET');
    req.flush(mockFeed);
  });

  it('loads the programmable schedule for a community-backed channel route', () => {
    const mockSchedule: ProgramBlockDto[] = [
      {
        id: 'block-1',
        channelId: 'channel-1',
        communityId: 'community-1',
        videoId: 'video-1',
        blockType: 'prerecorded',
        title: 'Morning replay',
        status: 'scheduled',
        startsAt: new Date('2026-04-17T14:00:00.000Z'),
        endsAt: new Date('2026-04-17T15:00:00.000Z'),
      },
    ];

    service.getChannelSchedule('ot-live').subscribe((schedule) => {
      expect(schedule).toEqual(mockSchedule);
    });

    const req = httpMock.expectOne('/api/videos/channels/ot-live/schedule');
    expect(req.request.method).toBe('GET');
    req.flush(mockSchedule);
  });

  it('starts a live session for a community-backed channel route', () => {
    const dto: StartLiveSessionDto = {
      communityId: 'community-1',
      startedByUserId: 'user-1',
      startedByProfileId: 'profile-1',
      title: 'Live now',
    };

    service.startLiveSession('ot-live', dto).subscribe();

    const req = httpMock.expectOne('/api/videos/channels/ot-live/live/start');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush({ id: 'live-1', status: 'live' });
  });

  it('updates channel locality anchors through the channel endpoint', async () => {
    const update: UpdateChannelDto = {
      name: 'Savannah Signal',
      anchorLat: 32.0809,
      anchorLng: -81.0912,
      timezone: 'America/New_York',
    };
    const response: ChannelDto = {
      id: 'channel-1',
      name: 'Savannah Signal',
      profileId: 'profile-1',
      userId: 'user-1',
      communityId: 'community-1',
      communitySlug: 'savannah-signal',
      anchorLat: 32.0809,
      anchorLng: -81.0912,
      timezone: 'America/New_York',
      createdAt: new Date('2026-06-20T12:00:00.000Z'),
      updatedAt: new Date('2026-06-29T12:00:00.000Z'),
    };

    const request = service.updateChannel('channel-1', update);
    const req = httpMock.expectOne('/api/videos/channels/channel-1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(update);
    req.flush(response);
    await expect(request).resolves.toEqual(response);
  });
});
