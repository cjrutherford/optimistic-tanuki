import { Injectable } from '@nestjs/common';

export type PlaylistItemKind =
  | 'live'
  | 'scheduled'
  | 'rerun'
  | 'ad'
  | 'filler'
  | 'offline';

export interface PlaylistDecision {
  kind: PlaylistItemKind;
  reason: string;
  sessionId?: string;
  blockId?: string;
  videoId?: string;
  placementType?: 'pre-roll' | 'mid-roll' | 'post-roll';
  mediaUrl?: string;
}

export interface PlaylistInputs {
  liveSessionId?: string | null;
  scheduledBlockId?: string | null;
  scheduledVideoId?: string | null;
  replayVideoId?: string | null;
  fillerVideoId?: string | null;
  ad?: {
    placementType: 'pre-roll' | 'mid-roll' | 'post-roll';
    mediaUrl: string;
  } | null;
}

@Injectable()
export class PlaylistGenerator {
  buildDecision(input: PlaylistInputs): PlaylistDecision {
    if (input.liveSessionId) {
      return {
        kind: 'live',
        sessionId: input.liveSessionId,
        reason: 'live-session-preempts-programming',
      };
    }

    const adCanInterruptSource =
      input.ad?.mediaUrl &&
      ((input.ad.placementType === 'pre-roll' && input.scheduledBlockId) ||
        (input.ad.placementType === 'mid-roll' && input.scheduledBlockId) ||
        (input.ad.placementType === 'post-roll' && input.replayVideoId));

    if (adCanInterruptSource) {
      return {
        kind: 'ad',
        placementType: input.ad.placementType,
        mediaUrl: input.ad.mediaUrl,
        reason: 'eligible-ad-break-preempts-program',
      };
    }

    if (input.scheduledBlockId) {
      return {
        kind: 'scheduled',
        blockId: input.scheduledBlockId,
        videoId: input.scheduledVideoId ?? undefined,
        reason: 'scheduled-program-is-live',
      };
    }

    if (input.replayVideoId) {
      return {
        kind: 'rerun',
        videoId: input.replayVideoId,
        reason: 'replay-maintains-continuity',
      };
    }

    if (input.fillerVideoId) {
      return {
        kind: 'filler',
        videoId: input.fillerVideoId,
        reason: 'configured-filler-maintains-continuity',
      };
    }

    return { kind: 'offline', reason: 'no-playable-source-available' };
  }
}
