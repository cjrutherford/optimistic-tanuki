import { of } from 'rxjs';
import { PlaylistGenerator } from './playlist-generator.service';
import { BroadcastSchedulerService } from './broadcast-scheduler.service';

describe('BroadcastSchedulerService ad targeting', () => {
  it('passes a targeted payment candidate into playlist decisions', async () => {
    const paymentService = {
      send: jest.fn().mockReturnValue(
        of([
          {
            campaignId: 'campaign-1',
            placementType: 'pre-roll',
            mediaUrl: 'https://ads.test/local.mp4',
          },
        ])
      ),
    };
    const service = new BroadcastSchedulerService(
      {
        refreshAllFeeds: jest.fn().mockResolvedValue([
          {
            id: 'feed-1',
            currentMode: 'scheduled',
            channelId: 'channel-1',
            communityId: 'community-1',
            activeProgramBlockId: 'block-1',
            activeVideoId: 'video-1',
          },
        ]),
        persistPlaylistDecision: jest.fn(),
      } as any,
      new PlaylistGenerator(),
      undefined,
      paymentService as any
    );

    await expect(service.runOnce()).resolves.toEqual(
      expect.objectContaining({
        decisions: [
          expect.objectContaining({
            kind: 'ad',
            placementType: 'pre-roll',
            mediaUrl: 'https://ads.test/local.mp4',
          }),
        ],
      })
    );
    expect(paymentService.send).toHaveBeenCalledWith(
      { cmd: 'payments.getEligiblePlaybackCampaigns' },
      {
        channelId: 'channel-1',
        communityId: 'community-1',
        placementType: 'pre-roll',
      }
    );
  });

  it('requests a mid-roll candidate for an active scheduled program', async () => {
    const paymentService = { send: jest.fn().mockReturnValue(of([])) };
    const service = new BroadcastSchedulerService(
      {
        refreshAllFeeds: jest.fn().mockResolvedValue([
          {
            id: 'feed-1',
            currentMode: 'scheduled',
            channelId: 'channel-1',
            communityId: 'community-1',
            activeProgramBlockId: 'block-1',
            activeVideoId: 'video-1',
            activePlaylistItem: { kind: 'scheduled' },
          },
        ]),
        persistPlaylistDecision: jest.fn(),
      } as any,
      new PlaylistGenerator(),
      undefined,
      paymentService as any
    );

    await service.runOnce();

    expect(paymentService.send).toHaveBeenCalledWith(
      { cmd: 'payments.getEligiblePlaybackCampaigns' },
      {
        channelId: 'channel-1',
        communityId: 'community-1',
        placementType: 'mid-roll',
      }
    );
  });

  it('keeps requesting mid-roll after a mid-roll decision on the next scheduler tick', async () => {
    const paymentService = { send: jest.fn().mockReturnValue(of([])) };
    const scheduledFeed = {
      id: 'feed-1',
      currentMode: 'scheduled',
      channelId: 'channel-1',
      communityId: 'community-1',
      activeProgramBlockId: 'block-1',
      activeVideoId: 'video-1',
    };
    const broadcastService = {
      refreshAllFeeds: jest
        .fn()
        .mockResolvedValueOnce([
          { ...scheduledFeed, activePlaylistItem: { kind: 'scheduled' } },
        ])
        .mockResolvedValueOnce([
          {
            ...scheduledFeed,
            activePlaylistItem: { kind: 'ad', placementType: 'mid-roll' },
          },
        ]),
      persistPlaylistDecision: jest.fn(),
    };
    const service = new BroadcastSchedulerService(
      broadcastService as any,
      new PlaylistGenerator(),
      undefined,
      paymentService as any
    );

    await service.runOnce();
    await service.runOnce();

    expect(paymentService.send).toHaveBeenNthCalledWith(
      2,
      { cmd: 'payments.getEligiblePlaybackCampaigns' },
      {
        channelId: 'channel-1',
        communityId: 'community-1',
        placementType: 'mid-roll',
      }
    );
  });

  it('requests a post-roll candidate for replay without relabeling it', async () => {
    const paymentService = {
      send: jest
        .fn()
        .mockReturnValue(of([{ mediaUrl: 'https://ads.test/post-roll.mp4' }])),
    };
    const service = new BroadcastSchedulerService(
      {
        refreshAllFeeds: jest.fn().mockResolvedValue([
          {
            id: 'feed-1',
            currentMode: 'replay',
            channelId: 'channel-1',
            communityId: 'community-1',
            activeVideoId: 'video-1',
          },
        ]),
        persistPlaylistDecision: jest.fn(),
      } as any,
      new PlaylistGenerator(),
      undefined,
      paymentService as any
    );

    await expect(service.runOnce()).resolves.toEqual(
      expect.objectContaining({
        decisions: [
          {
            kind: 'ad',
            placementType: 'post-roll',
            mediaUrl: 'https://ads.test/post-roll.mp4',
            reason: 'eligible-ad-break-preempts-program',
          },
        ],
      })
    );
  });

  it('does not request ads for live feeds and falls through without a candidate', async () => {
    const paymentService = { send: jest.fn() };
    const broadcastService = {
      refreshAllFeeds: jest.fn().mockResolvedValue([
        {
          id: 'feed-live',
          currentMode: 'live',
          channelId: 'channel-1',
          communityId: 'community-1',
          activeLiveSessionId: 'session-1',
          activeProgramBlockId: 'block-1',
        },
        {
          id: 'feed-scheduled',
          currentMode: 'scheduled',
          channelId: 'channel-2',
          communityId: 'community-2',
          activeProgramBlockId: 'block-2',
          activeVideoId: 'video-2',
        },
      ]),
      persistPlaylistDecision: jest.fn(),
    };
    paymentService.send.mockReturnValue(of([]));
    const service = new BroadcastSchedulerService(
      broadcastService as any,
      new PlaylistGenerator(),
      undefined,
      paymentService as any
    );

    await expect(service.runOnce()).resolves.toEqual(
      expect.objectContaining({
        decisions: [
          {
            kind: 'live',
            sessionId: 'session-1',
            reason: 'live-session-preempts-programming',
          },
          {
            kind: 'scheduled',
            blockId: 'block-2',
            videoId: 'video-2',
            reason: 'scheduled-program-is-live',
          },
        ],
      })
    );
    expect(paymentService.send).toHaveBeenCalledTimes(1);
  });
});
