import { BroadcastSchedulerService } from './broadcast-scheduler.service';
import { PlaylistGenerator } from './playlist-generator.service';

describe('BroadcastSchedulerService', () => {
  it('refreshes all feeds and reports the resulting playlist modes', async () => {
    const broadcastService = {
      refreshAllFeeds: jest.fn().mockResolvedValue([
        {
          id: 'feed-live',
          currentMode: 'live',
          activeLiveSessionId: 'session-1',
        },
        {
          id: 'feed-scheduled',
          currentMode: 'scheduled',
          activeProgramBlockId: 'block-1',
          activeVideoId: 'video-1',
        },
        { id: 'feed-replay', currentMode: 'replay', activeVideoId: 'replay-1' },
        { id: 'feed-offline', currentMode: 'offline' },
      ]),
      persistPlaylistDecision: jest.fn(),
    };
    const service = new BroadcastSchedulerService(
      broadcastService as any,
      new PlaylistGenerator()
    );

    await expect(
      service.runOnce(new Date('2026-07-12T12:00:00.000Z'))
    ).resolves.toEqual({
      processedFeeds: 4,
      liveFeeds: 1,
      scheduledFeeds: 1,
      replayFeeds: 1,
      offlineFeeds: 1,
      decisions: [
        {
          kind: 'live',
          sessionId: 'session-1',
          reason: 'live-session-preempts-programming',
        },
        {
          kind: 'scheduled',
          blockId: 'block-1',
          videoId: 'video-1',
          reason: 'scheduled-program-is-live',
        },
        {
          kind: 'rerun',
          videoId: 'replay-1',
          reason: 'replay-maintains-continuity',
        },
        { kind: 'offline', reason: 'no-playable-source-available' },
      ],
    });
    expect(broadcastService.refreshAllFeeds).toHaveBeenCalledWith(
      new Date('2026-07-12T12:00:00.000Z')
    );
    expect(broadcastService.persistPlaylistDecision).toHaveBeenCalledWith(
      'feed-scheduled',
      {
        kind: 'scheduled',
        blockId: 'block-1',
        videoId: 'video-1',
        reason: 'scheduled-program-is-live',
      },
      new Date('2026-07-12T12:00:00.000Z')
    );
  });

  it('does not start a timer when scheduling is disabled', () => {
    const broadcastService = { refreshAllFeeds: jest.fn() };
    const service = new BroadcastSchedulerService(
      broadcastService as any,
      new PlaylistGenerator(),
      { enabled: false }
    );

    service.onModuleInit();

    expect(broadcastService.refreshAllFeeds).not.toHaveBeenCalled();
  });
});
