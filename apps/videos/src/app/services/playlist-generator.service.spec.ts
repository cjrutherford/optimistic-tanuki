import { PlaylistGenerator } from './playlist-generator.service';

describe('PlaylistGenerator', () => {
  const generator = new PlaylistGenerator();

  it('lets an active live session preempt scheduled programming and ads', () => {
    expect(
      generator.buildDecision({
        liveSessionId: 'session-1',
        scheduledBlockId: 'block-1',
        scheduledVideoId: 'video-1',
        ad: { placementType: 'pre-roll', mediaUrl: 'ad.mp4' },
      })
    ).toEqual({
      kind: 'live',
      sessionId: 'session-1',
      reason: 'live-session-preempts-programming',
    });
  });

  it('inserts a valid ad before the next program when an ad break is available', () => {
    expect(
      generator.buildDecision({
        scheduledBlockId: 'block-1',
        scheduledVideoId: 'video-1',
        ad: { placementType: 'pre-roll', mediaUrl: 'ad.mp4' },
      })
    ).toEqual({
      kind: 'ad',
      placementType: 'pre-roll',
      mediaUrl: 'ad.mp4',
      reason: 'eligible-ad-break-preempts-program',
    });
  });

  it.each([
    ['pre-roll', { scheduledBlockId: 'block-1' }],
    ['mid-roll', { scheduledBlockId: 'block-1' }],
    ['post-roll', { replayVideoId: 'replay-1' }],
  ] as const)(
    'preserves the %s placement for its matching source',
    (placementType, source) => {
      expect(
        generator.buildDecision({
          ...source,
          ad: { placementType, mediaUrl: `${placementType}.mp4` },
        })
      ).toEqual({
        kind: 'ad',
        placementType,
        mediaUrl: `${placementType}.mp4`,
        reason: 'eligible-ad-break-preempts-program',
      });
    }
  );

  it('does not use a mid-roll ad as a replay post-roll', () => {
    expect(
      generator.buildDecision({
        replayVideoId: 'replay-1',
        ad: { placementType: 'mid-roll', mediaUrl: 'mid-roll.mp4' },
      })
    ).toEqual({
      kind: 'rerun',
      videoId: 'replay-1',
      reason: 'replay-maintains-continuity',
    });
  });

  it('falls back from replay to configured filler and finally offline', () => {
    expect(generator.buildDecision({ replayVideoId: 'replay-1' })).toEqual({
      kind: 'rerun',
      videoId: 'replay-1',
      reason: 'replay-maintains-continuity',
    });
    expect(generator.buildDecision({ fillerVideoId: 'filler-1' })).toEqual({
      kind: 'filler',
      videoId: 'filler-1',
      reason: 'configured-filler-maintains-continuity',
    });
    expect(generator.buildDecision({})).toEqual({
      kind: 'offline',
      reason: 'no-playable-source-available',
    });
  });
});
