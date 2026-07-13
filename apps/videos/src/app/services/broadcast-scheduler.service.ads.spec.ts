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
});
