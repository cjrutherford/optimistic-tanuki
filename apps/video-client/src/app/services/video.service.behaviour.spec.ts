import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { VideoService } from './video.service';
import {
  ChannelDto,
  ChannelSubscriptionDto,
  CreateChannelDto,
  CreateProgramBlockDto,
  CreateVideoDto,
  SubscribeDto,
  VideoDto,
} from '@optimistic-tanuki/ui-models';

const videoFixture: VideoDto = {
  id: 'video-1',
  title: 'Tanuki tour',
  description: 'A tour',
  assetId: 'asset-1',
  channelId: 'channel-1',
  processingStatus: 'ready',
  viewCount: 12,
  likeCount: 3,
  visibility: 'public',
  createdAt: new Date('2026-04-17T14:00:00.000Z'),
  updatedAt: new Date('2026-04-17T14:00:00.000Z'),
};

const channelFixture: ChannelDto = {
  id: 'channel-1',
  name: 'Optimistic Tanuki Live',
  profileId: 'profile-1',
  userId: 'user-1',
  communityId: 'community-1',
  createdAt: new Date('2026-04-17T14:00:00.000Z'),
  updatedAt: new Date('2026-04-17T14:00:00.000Z'),
};

const subscriptionFixture: ChannelSubscriptionDto = {
  id: 'subscription-1',
  channelId: 'channel-1',
  userId: 'user-1',
  profileId: 'profile-1',
  subscribedAt: new Date('2026-04-17T14:00:00.000Z'),
};

describe('VideoService behaviour', () => {
  let service: VideoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        VideoService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(VideoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('video reads', () => {
    it('lists every video from the collection endpoint', () => {
      let received: VideoDto[] | undefined;
      service.getVideos().subscribe((videos) => (received = videos));

      const request = http.expectOne('/api/videos');
      expect(request.request.method).toBe('GET');
      request.flush([videoFixture]);

      expect(received).toEqual([videoFixture]);
    });

    it('reads a single video by id', () => {
      let received: VideoDto | undefined;
      service.getVideo('video-1').subscribe((video) => (received = video));

      const request = http.expectOne('/api/videos/video-1');
      expect(request.request.method).toBe('GET');
      request.flush(videoFixture);

      expect(received).toEqual(videoFixture);
    });

    // The recommended/trending endpoints only append ?limit= when a limit is
    // supplied, so both shapes of each URL are pinned here.
    it.each([
      ['getRecommendedVideos', undefined, '/api/videos/recommended'],
      ['getRecommendedVideos', 5, '/api/videos/recommended?limit=5'],
      ['getTrendingVideos', undefined, '/api/videos/trending'],
      ['getTrendingVideos', 5, '/api/videos/trending?limit=5'],
    ] as const)('%s(%s) requests %s', (method, limit, expectedUrl) => {
      let received: VideoDto[] | undefined;
      service[method](limit).subscribe((videos) => (received = videos));

      const request = http.expectOne(expectedUrl);
      expect(request.request.method).toBe('GET');
      request.flush([videoFixture]);

      expect(received).toEqual([videoFixture]);
    });
  });

  describe('video writes', () => {
    it('posts the create payload to the video collection', () => {
      const dto: CreateVideoDto = {
        title: 'Tanuki tour',
        assetId: 'asset-1',
        channelId: 'channel-1',
        visibility: 'public',
      };

      let created: VideoDto | undefined;
      service.createVideo(dto).subscribe((video) => (created = video));

      const request = http.expectOne('/api/videos');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual(dto);
      request.flush(videoFixture);

      expect(created).toEqual(videoFixture);
    });

    it.each([
      ['incrementViewCount', '/api/videos/video-1/view'],
      ['likeVideo', '/api/videos/video-1/like'],
    ] as const)('%s posts an empty body to %s', (method, expectedUrl) => {
      let completed = false;
      service[method]('video-1').subscribe({
        complete: () => (completed = true),
      });

      const request = http.expectOne(expectedUrl);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({});
      request.flush(null);

      expect(completed).toBe(true);
    });

    it('deletes the like when unliking a video', () => {
      let completed = false;
      service
        .unlikeVideo('video-1')
        .subscribe({ complete: () => (completed = true) });

      const request = http.expectOne('/api/videos/video-1/like');
      expect(request.request.method).toBe('DELETE');
      request.flush(null);

      expect(completed).toBe(true);
    });
  });

  describe('channels', () => {
    it('lists channels', () => {
      let received: ChannelDto[] | undefined;
      service.getChannels().subscribe((channels) => (received = channels));

      const request = http.expectOne('/api/videos/channels');
      expect(request.request.method).toBe('GET');
      request.flush([channelFixture]);

      expect(received).toEqual([channelFixture]);
    });

    it('reads a single channel by id', () => {
      let received: ChannelDto | undefined;
      service.getChannel('channel-1').subscribe((c) => (received = c));

      const request = http.expectOne('/api/videos/channels/channel-1');
      expect(request.request.method).toBe('GET');
      request.flush(channelFixture);

      expect(received).toEqual(channelFixture);
    });

    it('lists the channels owned by a user', () => {
      let received: ChannelDto[] | undefined;
      service.getUserChannels('user-1').subscribe((c) => (received = c));

      const request = http.expectOne('/api/videos/channels/user/user-1');
      expect(request.request.method).toBe('GET');
      request.flush([channelFixture]);

      expect(received).toEqual([channelFixture]);
    });

    it('resolves getMyChannels from the channel collection', async () => {
      const pending = service.getMyChannels();

      const request = http.expectOne('/api/videos/channels');
      expect(request.request.method).toBe('GET');
      request.flush([channelFixture]);

      await expect(pending).resolves.toEqual([channelFixture]);
    });

    it('resolves the videos belonging to a channel', async () => {
      const pending = service.getChannelVideos('channel-1');

      const request = http.expectOne('/api/videos/channel/channel-1');
      expect(request.request.method).toBe('GET');
      request.flush([videoFixture]);

      await expect(pending).resolves.toEqual([videoFixture]);
    });

    it('posts the create payload when creating a channel', async () => {
      const dto: CreateChannelDto = {
        name: 'Optimistic Tanuki Live',
        profileId: 'profile-1',
        userId: 'user-1',
        communityId: 'community-1',
      };

      const pending = service.createChannel(dto);

      const request = http.expectOne('/api/videos/channels');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual(dto);
      request.flush(channelFixture);

      await expect(pending).resolves.toEqual(channelFixture);
    });
  });

  describe('programming and live sessions', () => {
    it('posts a program block against the channel schedule', () => {
      const dto: CreateProgramBlockDto = {
        communityId: 'community-1',
        channelId: 'channel-1',
        videoId: 'video-1',
        blockType: 'prerecorded',
        title: 'Morning replay',
        startsAt: '2026-04-17T14:00:00.000Z',
        endsAt: '2026-04-17T15:00:00.000Z',
      };

      let createdId: string | undefined;
      service
        .createProgramBlock('ot-live', dto)
        .subscribe((block) => (createdId = block.id));

      const request = http.expectOne('/api/videos/channels/ot-live/schedule');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual(dto);
      request.flush({ id: 'block-1' });

      expect(createdId).toBe('block-1');
    });

    it('stops a live session with an empty body and surfaces the ended session', () => {
      let status: string | undefined;
      service
        .stopLiveSession('ot-live')
        .subscribe((session) => (status = session?.status));

      const request = http.expectOne('/api/videos/channels/ot-live/live/stop');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({});
      request.flush({ id: 'live-1', status: 'ended' });

      expect(status).toBe('ended');
    });
  });

  describe('subscriptions', () => {
    it('posts the subscribe payload', () => {
      const dto: SubscribeDto = {
        channelId: 'channel-1',
        userId: 'user-1',
        profileId: 'profile-1',
      };

      let received: ChannelSubscriptionDto | undefined;
      service.subscribeToChannel(dto).subscribe((s) => (received = s));

      const request = http.expectOne('/api/videos/subscriptions');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual(dto);
      request.flush(subscriptionFixture);

      expect(received).toEqual(subscriptionFixture);
    });

    it('sends the user id in the DELETE body when unsubscribing', () => {
      let completed = false;
      service
        .unsubscribeFromChannel('channel-1', 'user-1')
        .subscribe({ complete: () => (completed = true) });

      const request = http.expectOne('/api/videos/subscriptions/channel-1');
      expect(request.request.method).toBe('DELETE');
      expect(request.request.body).toEqual({ userId: 'user-1' });
      request.flush(null);

      expect(completed).toBe(true);
    });

    it('lists the subscriptions held by a user', () => {
      let received: ChannelSubscriptionDto[] | undefined;
      service.getUserSubscriptions('user-1').subscribe((s) => (received = s));

      const request = http.expectOne('/api/videos/subscriptions/user/user-1');
      expect(request.request.method).toBe('GET');
      request.flush([subscriptionFixture]);

      expect(received).toEqual([subscriptionFixture]);
    });

    it('lists the subscribers of a channel', () => {
      let received: ChannelSubscriptionDto[] | undefined;
      service
        .getChannelSubscribers('channel-1')
        .subscribe((s) => (received = s));

      const request = http.expectOne(
        '/api/videos/subscriptions/channel/channel-1'
      );
      expect(request.request.method).toBe('GET');
      request.flush([subscriptionFixture]);

      expect(received).toEqual([subscriptionFixture]);
    });
  });

  describe('asset url helpers', () => {
    it.each([
      ['getAssetUrl' as const],
      ['getVideoUrl' as const],
      ['getHlsUrl' as const],
    ])('%s builds the asset path for a known asset', (method) => {
      expect(service[method]('asset-1')).toBe('/api/asset/asset-1');
    });

    it('returns null from getHlsUrl when no asset id is available', () => {
      expect(service.getHlsUrl(undefined)).toBeNull();
    });
  });
});
