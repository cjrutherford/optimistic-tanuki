import { Repository } from 'typeorm';
import { BroadcastService } from './broadcast.service';
import { ChannelFeed } from '../../entities/channel-feed.entity';
import { ProgramBlock } from '../../entities/program-block.entity';
import { LiveSession } from '../../entities/live-session.entity';
import { LiveMediaTransportService } from './live-media-transport.service';
import { PlaylistDecisionHistory } from '../../entities/playlist-decision-history.entity';
import { Channel } from '../../entities/channel.entity';

describe('BroadcastService', () => {
  let service: BroadcastService;
  let feedRepository: jest.Mocked<Partial<Repository<ChannelFeed>>>;
  let blockRepository: jest.Mocked<Partial<Repository<ProgramBlock>>>;
  let sessionRepository: jest.Mocked<Partial<Repository<LiveSession>>>;
  let channelRepository: jest.Mocked<Partial<Repository<Channel>>>;
  let playlistHistoryRepository: jest.Mocked<
    Partial<Repository<PlaylistDecisionHistory>>
  >;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-08T18:00:00.000Z'));

    feedRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    blockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    sessionRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };
    channelRepository = {
      findOne: jest.fn(),
    };
    playlistHistoryRepository = {
      create: jest.fn((input) => input as PlaylistDecisionHistory),
      save: jest.fn(async (input) => input as PlaylistDecisionHistory),
    } as unknown as jest.Mocked<Partial<Repository<PlaylistDecisionHistory>>>;

    service = new BroadcastService(
      feedRepository as Repository<ChannelFeed>,
      blockRepository as Repository<ProgramBlock>,
      sessionRepository as Repository<LiveSession>,
      new LiveMediaTransportService(),
      channelRepository as Repository<Channel>,
      playlistHistoryRepository as Repository<PlaylistDecisionHistory>
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('derives trustworthy schedule statuses from the current time', async () => {
    blockRepository.find!.mockResolvedValue([
      {
        id: 'block-past',
        communityId: 'community-1',
        channelId: 'channel-1',
        blockType: 'prerecorded',
        title: 'Morning replay',
        startsAt: new Date('2026-07-08T15:00:00.000Z'),
        endsAt: new Date('2026-07-08T16:00:00.000Z'),
        status: 'scheduled',
      },
      {
        id: 'block-now',
        communityId: 'community-1',
        channelId: 'channel-1',
        blockType: 'live_window',
        title: 'City Hall live',
        startsAt: new Date('2026-07-08T17:30:00.000Z'),
        endsAt: new Date('2026-07-08T18:30:00.000Z'),
        status: 'scheduled',
      },
      {
        id: 'block-next',
        communityId: 'community-1',
        channelId: 'channel-1',
        blockType: 'prerecorded',
        title: 'Night recap',
        startsAt: new Date('2026-07-08T19:00:00.000Z'),
        endsAt: new Date('2026-07-08T20:00:00.000Z'),
        status: 'scheduled',
      },
    ] as ProgramBlock[]);
    blockRepository.save!.mockImplementation(
      async (input) => input as ProgramBlock
    );

    const result = await service.getScheduleByCommunityId('community-1');

    expect(
      result.map((block) => ({ id: block.id, status: block.status }))
    ).toEqual([
      { id: 'block-past', status: 'completed' },
      { id: 'block-now', status: 'live' },
      { id: 'block-next', status: 'scheduled' },
    ]);
  });

  it('resolves the feed to the currently airing scheduled block', async () => {
    const feed = {
      id: 'feed-1',
      communityId: 'community-1',
      channelId: 'channel-1',
      timezone: 'America/New_York',
      currentMode: 'offline',
      activeProgramBlockId: null,
      activeLiveSessionId: null,
      activeVideoId: null,
      lastTransitionAt: new Date('2026-07-08T17:00:00.000Z'),
    } as unknown as ChannelFeed;

    feedRepository.findOne!.mockResolvedValue(feed);
    blockRepository.find!.mockResolvedValue([
      {
        id: 'block-now',
        communityId: 'community-1',
        channelId: 'channel-1',
        videoId: 'video-1',
        blockType: 'prerecorded',
        title: 'Local spotlight',
        startsAt: new Date('2026-07-08T17:45:00.000Z'),
        endsAt: new Date('2026-07-08T18:15:00.000Z'),
        status: 'scheduled',
      },
    ] as ProgramBlock[]);
    blockRepository.save!.mockImplementation(
      async (input) => input as ProgramBlock
    );
    feedRepository.save!.mockImplementation(
      async (input) => input as ChannelFeed
    );

    const result = await service.getFeedByCommunityId('community-1');

    expect(feedRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'feed-1',
        currentMode: 'scheduled',
        activeProgramBlockId: 'block-now',
        activeVideoId: 'video-1',
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        currentMode: 'scheduled',
        activeProgramBlockId: 'block-now',
        activeVideoId: 'video-1',
      })
    );
  });

  it('persists a scheduler decision as the feed current playlist item', async () => {
    const feed = {
      id: 'feed-1',
      activePlaylistKind: 'offline',
      activePlaylistReason: 'no-playable-source-available',
      activePlaylistPlacementType: null,
      activePlaylistMediaUrl: null,
      activePlaylistDecidedAt: null,
    } as ChannelFeed;
    const decidedAt = new Date('2026-07-12T18:00:00.000Z');
    feedRepository.findOne!.mockResolvedValue(feed);
    feedRepository.save!.mockImplementation(
      async (input) => input as ChannelFeed
    );

    await service.persistPlaylistDecision(
      'feed-1',
      {
        kind: 'ad',
        blockId: 'block-1',
        placementType: 'pre-roll',
        mediaUrl: 'https://media.example/ad.mp4',
        reason: 'eligible-ad-break-preempts-program',
      },
      decidedAt
    );

    expect(feedRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'feed-1',
        activePlaylistKind: 'ad',
        activePlaylistReason: 'eligible-ad-break-preempts-program',
        activePlaylistBlockId: 'block-1',
        activePlaylistPlacementType: 'pre-roll',
        activePlaylistMediaUrl: 'https://media.example/ad.mp4',
        activePlaylistDecidedAt: decidedAt,
      })
    );
    expect(playlistHistoryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        feedId: 'feed-1',
        blockId: 'block-1',
        placementType: 'pre-roll',
      })
    );
  });

  it('does not rewrite an unchanged scheduler decision', async () => {
    const feed = {
      id: 'feed-1',
      activePlaylistKind: 'scheduled',
      activePlaylistReason: 'scheduled-program-is-live',
      activePlaylistSessionId: null,
      activePlaylistBlockId: 'block-1',
      activePlaylistVideoId: 'video-1',
      activePlaylistPlacementType: null,
      activePlaylistMediaUrl: null,
      activePlaylistDecidedAt: new Date('2026-07-12T18:00:00.000Z'),
    } as unknown as ChannelFeed;
    feedRepository.findOne!.mockResolvedValue(feed);

    await service.persistPlaylistDecision(
      'feed-1',
      {
        kind: 'scheduled',
        blockId: 'block-1',
        videoId: 'video-1',
        reason: 'scheduled-program-is-live',
      },
      new Date('2026-07-12T18:00:15.000Z')
    );

    expect(feedRepository.save).not.toHaveBeenCalled();
  });

  it('interrupts the current prerecorded block when live goes on air', async () => {
    const scheduledBlock = {
      id: 'block-1',
      communityId: 'community-1',
      blockType: 'prerecorded',
      title: 'Morning replay',
      startsAt: new Date('2026-04-17T13:00:00.000Z'),
      endsAt: new Date('2026-04-17T14:00:00.000Z'),
      status: 'live',
    } as ProgramBlock;
    const feed = {
      id: 'feed-1',
      communityId: 'community-1',
      timezone: 'America/New_York',
      currentMode: 'scheduled',
      activeProgramBlockId: 'block-1',
    } as ChannelFeed;

    feedRepository.findOne!.mockResolvedValue(feed);
    blockRepository.findOne!.mockResolvedValue(scheduledBlock);
    sessionRepository.create!.mockImplementation(
      (input) => input as LiveSession
    );
    sessionRepository.save!.mockImplementation(
      async (input) => input as LiveSession
    );
    blockRepository.save!.mockImplementation(
      async (input) => input as ProgramBlock
    );
    feedRepository.save!.mockImplementation(
      async (input) => input as ChannelFeed
    );

    const result = await service.startLiveSession({
      communityId: 'community-1',
      title: 'Breaking live update',
      startedByUserId: 'user-1',
      startedByProfileId: 'profile-1',
    });

    expect(blockRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'block-1',
        status: 'interrupted',
      })
    );
    expect(feedRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        communityId: 'community-1',
        currentMode: 'live',
        activeProgramBlockId: null,
        activeLiveSessionId: expect.any(String),
      })
    );
    expect(result.status).toBe('live');
  });

  it('returns explicit live handoff state while a live session is active', async () => {
    const feed = {
      id: 'feed-1',
      communityId: 'community-1',
      channelId: 'channel-1',
      timezone: 'America/New_York',
      currentMode: 'live',
      activeProgramBlockId: null,
      activeLiveSessionId: 'session-1',
      activeVideoId: null,
      lastTransitionAt: new Date('2026-07-08T17:45:00.000Z'),
    } as ChannelFeed;
    const session = {
      id: 'session-1',
      communityId: 'community-1',
      channelId: 'channel-1',
      title: 'Savannah Signal Live',
      description: 'Tonight from Forsyth Park',
      status: 'live',
      startedByUserId: 'user-1',
      startedByProfileId: 'profile-1',
      startedAt: new Date('2026-07-08T17:30:00.000Z'),
      endedAt: null,
    } as LiveSession;

    feedRepository.findOne!.mockResolvedValue(feed);
    sessionRepository.findOne!.mockResolvedValue(session);

    const result = await service.getFeedByCommunityId('community-1');

    expect(result).toEqual(
      expect.objectContaining({
        currentMode: 'live',
        activeLiveSessionId: 'session-1',
        activeLiveSession: expect.objectContaining({
          id: 'session-1',
          title: 'Savannah Signal Live',
          status: 'live',
        }),
        liveHandoff: expect.objectContaining({
          status: 'ready',
          requiresAuth: false,
          tokenContract: 'gateway-token-exchange',
          localityPolicy: 'unverified-anchor-radius',
        }),
      })
    );
  });

  it('issues a short-lived playback token only for the active live session', async () => {
    feedRepository.findOne!.mockResolvedValue({
      communityId: 'community-1',
      currentMode: 'live',
      activeLiveSessionId: 'session-1',
    } as ChannelFeed);
    sessionRepository.findOne!.mockResolvedValue({
      id: 'session-1',
      communityId: 'community-1',
      status: 'live',
      liveSourceUrl: 'https://media.example/live.m3u8',
    } as LiveSession);

    channelRepository.findOne!.mockResolvedValue({
      communityId: 'community-1',
      anchorLat: 32.0809,
      anchorLng: -81.0912,
    } as Channel);

    const result = await service.issueLiveToken('community-1', {
      viewerLat: 32.0809,
      viewerLng: -81.0912,
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'ready',
        sessionId: 'session-1',
        playbackUrl: 'https://media.example/live.m3u8',
        token: expect.any(String),
        expiresAt: expect.any(Date),
      })
    );
    expect(result.expiresAt!.getTime()).toBe(
      new Date('2026-07-08T18:05:00.000Z').getTime()
    );
  });

  it('denies a live token when the viewer is outside the channel anchor radius', async () => {
    feedRepository.findOne!.mockResolvedValue({
      communityId: 'community-1',
      currentMode: 'live',
      activeLiveSessionId: 'session-1',
    } as ChannelFeed);
    sessionRepository.findOne!.mockResolvedValue({
      id: 'session-1',
      communityId: 'community-1',
      status: 'live',
      liveSourceUrl: 'https://media.example/live.m3u8',
    } as LiveSession);
    channelRepository.findOne!.mockResolvedValue({
      communityId: 'community-1',
      anchorLat: 32.0809,
      anchorLng: -81.0912,
    } as Channel);

    await expect(
      service.issueLiveToken('community-1', {
        viewerLat: 33.749,
        viewerLng: -84.388,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'unavailable',
        token: null,
        unavailableReason: 'outside-anchor-radius',
      })
    );
  });

  it('denies a live token without browser coordinates', async () => {
    feedRepository.findOne!.mockResolvedValue({
      communityId: 'community-1',
      currentMode: 'live',
      activeLiveSessionId: 'session-1',
    } as ChannelFeed);
    sessionRepository.findOne!.mockResolvedValue({
      id: 'session-1',
      communityId: 'community-1',
      status: 'live',
    } as LiveSession);
    channelRepository.findOne!.mockResolvedValue({
      communityId: 'community-1',
      anchorLat: 32.0809,
      anchorLng: -81.0912,
    } as Channel);

    await expect(service.issueLiveToken('community-1')).resolves.toEqual(
      expect.objectContaining({
        status: 'unavailable',
        token: null,
        unavailableReason: 'viewer-location-required',
      })
    );
  });

  it('denies a live token with impossible browser coordinates', async () => {
    feedRepository.findOne!.mockResolvedValue({
      communityId: 'community-1',
      currentMode: 'live',
      activeLiveSessionId: 'session-1',
    } as ChannelFeed);
    sessionRepository.findOne!.mockResolvedValue({
      id: 'session-1',
      communityId: 'community-1',
      status: 'live',
    } as LiveSession);

    await expect(
      service.issueLiveToken('community-1', {
        viewerLat: 91,
        viewerLng: -81.0912,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'unavailable',
        unavailableReason: 'invalid-viewer-location',
      })
    );
  });

  it('denies a live token when the channel has no anchor', async () => {
    feedRepository.findOne!.mockResolvedValue({
      communityId: 'community-1',
      currentMode: 'live',
      activeLiveSessionId: 'session-1',
    } as ChannelFeed);
    sessionRepository.findOne!.mockResolvedValue({
      id: 'session-1',
      communityId: 'community-1',
      status: 'live',
    } as LiveSession);
    channelRepository.findOne!.mockResolvedValue({
      communityId: 'community-1',
      anchorLat: null,
      anchorLng: null,
    } as Channel);

    await expect(
      service.issueLiveToken('community-1', {
        viewerLat: 32.0809,
        viewerLng: -81.0912,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'unavailable',
        token: null,
        unavailableReason: 'channel-anchor-unavailable',
      })
    );
  });

  it('includes a LiveKit connection only when the provider is configured', async () => {
    const originalEnvironment = {
      url: process.env['LIVEKIT_URL'],
      apiKey: process.env['LIVEKIT_API_KEY'],
      apiSecret: process.env['LIVEKIT_API_SECRET'],
    };
    process.env['LIVEKIT_URL'] = 'https://live.example.test';
    process.env['LIVEKIT_API_KEY'] = 'livekit-key';
    process.env['LIVEKIT_API_SECRET'] = 'livekit-secret';
    feedRepository.findOne!.mockResolvedValue({
      communityId: 'community-1',
      currentMode: 'live',
      activeLiveSessionId: 'session-1',
    } as ChannelFeed);
    sessionRepository.findOne!.mockResolvedValue({
      id: 'session-1',
      communityId: 'community-1',
      status: 'live',
      liveSourceUrl: 'https://media.example/live.m3u8',
    } as LiveSession);
    channelRepository.findOne!.mockResolvedValue({
      communityId: 'community-1',
      anchorLat: 32.0809,
      anchorLng: -81.0912,
    } as Channel);

    try {
      const result = await service.issueLiveToken('community-1', {
        viewerLat: 32.0809,
        viewerLng: -81.0912,
      });

      expect(result.mediaTransport).toEqual(
        expect.objectContaining({
          type: 'livekit',
          serverUrl: 'wss://live.example.test',
          roomName: 'metrocast-community-1-session-1',
          token: expect.any(String),
        })
      );
      const [, payload] = result.mediaTransport!.token.split('.');
      expect(
        JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
      ).toEqual(
        expect.objectContaining({
          iss: 'livekit-key',
          sub: expect.stringMatching(/^viewer-/),
          video: expect.objectContaining({
            room: 'metrocast-community-1-session-1',
            roomJoin: true,
            canPublish: false,
            canSubscribe: true,
          }),
        })
      );
    } finally {
      restoreEnvironmentValue('LIVEKIT_URL', originalEnvironment.url);
      restoreEnvironmentValue('LIVEKIT_API_KEY', originalEnvironment.apiKey);
      restoreEnvironmentValue(
        'LIVEKIT_API_SECRET',
        originalEnvironment.apiSecret
      );
    }
  });

  it('validates a signed token only for its active live session and community', async () => {
    const feed = {
      communityId: 'community-1',
      currentMode: 'live',
      activeLiveSessionId: 'session-1',
    } as ChannelFeed;
    const session = {
      id: 'session-1',
      communityId: 'community-1',
      status: 'live',
      endedAt: null,
      liveSourceUrl: 'https://media.example/live.m3u8',
    } as LiveSession;
    feedRepository.findOne!.mockResolvedValue(feed);
    sessionRepository.findOne!.mockResolvedValue(session);
    channelRepository.findOne!.mockResolvedValue({
      communityId: 'community-1',
      anchorLat: 32.0809,
      anchorLng: -81.0912,
    } as Channel);

    const viewerLocation = { viewerLat: 32.0809, viewerLng: -81.0912 };
    const issued = await service.issueLiveToken('community-1', viewerLocation);
    const valid = await service.validateLiveToken(
      'community-1',
      issued.token!,
      viewerLocation
    );
    const wrongCommunity = await service.validateLiveToken(
      'community-2',
      issued.token!,
      viewerLocation
    );
    const tampered = await service.validateLiveToken(
      'community-1',
      `${issued.token!.slice(0, -1)}x`,
      viewerLocation
    );

    expect(valid).toEqual(
      expect.objectContaining({
        valid: true,
        sessionId: 'session-1',
        playbackUrl: 'https://media.example/live.m3u8',
      })
    );
    expect(wrongCommunity).toEqual({ valid: false });
    expect(tampered).toEqual({ valid: false });
  });

  it('rejects validation when the caller omits the issued browser location', async () => {
    const feed = {
      communityId: 'community-1',
      currentMode: 'live',
      activeLiveSessionId: 'session-1',
    } as ChannelFeed;
    const session = {
      id: 'session-1',
      communityId: 'community-1',
      status: 'live',
      endedAt: null,
    } as LiveSession;
    feedRepository.findOne!.mockResolvedValue(feed);
    sessionRepository.findOne!.mockResolvedValue(session);
    channelRepository.findOne!.mockResolvedValue({
      communityId: 'community-1',
      anchorLat: 32.0809,
      anchorLng: -81.0912,
    } as Channel);

    const issued = await service.issueLiveToken('community-1', {
      viewerLat: 32.0809,
      viewerLng: -81.0912,
    });

    await expect(
      service.validateLiveToken('community-1', issued.token!)
    ).resolves.toEqual({ valid: false, reason: 'viewer-location-required' });
  });

  it('returns an unavailable handoff token when the channel is not live', async () => {
    feedRepository.findOne!.mockResolvedValue({
      communityId: 'community-1',
      currentMode: 'scheduled',
      activeLiveSessionId: null,
    } as ChannelFeed);

    await expect(service.issueLiveToken('community-1')).resolves.toEqual({
      status: 'unavailable',
      sessionId: null,
      playbackUrl: null,
      token: null,
      expiresAt: null,
    });
  });

  it('falls back to replay continuity when a live session ends between scheduled blocks', async () => {
    const feed = {
      id: 'feed-1',
      communityId: 'community-1',
      channelId: 'channel-1',
      timezone: 'America/New_York',
      currentMode: 'live',
      activeProgramBlockId: null,
      activeLiveSessionId: 'session-1',
      activeVideoId: null,
      lastTransitionAt: new Date('2026-07-08T17:45:00.000Z'),
    } as ChannelFeed;
    const session = {
      id: 'session-1',
      communityId: 'community-1',
      channelId: 'channel-1',
      title: 'Breaking live update',
      status: 'live',
      startedAt: new Date('2026-07-08T17:30:00.000Z'),
      startedByUserId: 'user-1',
      startedByProfileId: 'profile-1',
    } as LiveSession;

    feedRepository.findOne!.mockResolvedValue(feed);
    sessionRepository.findOne!.mockResolvedValue(session);
    sessionRepository.save!.mockImplementation(
      async (input) => input as LiveSession
    );
    blockRepository.find!.mockResolvedValue([
      {
        id: 'block-replay',
        communityId: 'community-1',
        channelId: 'channel-1',
        videoId: 'video-1',
        blockType: 'prerecorded',
        title: 'Morning replay',
        startsAt: new Date('2026-07-08T16:00:00.000Z'),
        endsAt: new Date('2026-07-08T17:00:00.000Z'),
        status: 'completed',
      },
      {
        id: 'block-next',
        communityId: 'community-1',
        channelId: 'channel-1',
        videoId: 'video-2',
        blockType: 'prerecorded',
        title: 'Evening recap',
        startsAt: new Date('2026-07-08T19:00:00.000Z'),
        endsAt: new Date('2026-07-08T20:00:00.000Z'),
        status: 'scheduled',
      },
    ] as ProgramBlock[]);
    blockRepository.save!.mockImplementation(
      async (input) => input as ProgramBlock
    );
    feedRepository.save!.mockImplementation(
      async (input) => input as ChannelFeed
    );

    await service.stopLiveSession('community-1');

    expect(feedRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'feed-1',
        currentMode: 'replay',
        activeProgramBlockId: 'block-replay',
        activeVideoId: 'video-1',
        activeLiveSessionId: null,
      })
    );
  });
});

function restoreEnvironmentValue(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}
