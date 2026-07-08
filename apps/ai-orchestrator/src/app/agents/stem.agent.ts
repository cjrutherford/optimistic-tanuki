import { Injectable, Logger } from '@nestjs/common';
import {
  AudioAgent,
  AudioAgentInput,
  AudioAgentOutput,
} from './audio-agent.interface';

@Injectable()
export class StemAgent implements AudioAgent {
  readonly name = 'stem';
  private readonly logger = new Logger(StemAgent.name);

  async execute(input: AudioAgentInput): Promise<AudioAgentOutput> {
    this.logger.log(`Stem agent executing for request ${input.requestId}`);

    try {
      const assetId = input.voiceMemoAssetId || input.referenceTrackAssetId;
      if (!assetId) {
        return {
          success: false,
          error: 'No audio asset provided for stem separation',
        };
      }

      this.logger.debug(`Separating stems from asset ${assetId}`);

      // In production, this would call Demucs via the audio-models container
      // to separate the audio into stems: vocals, drums, bass, other

      const result: AudioAgentOutput = {
        success: true,
        trackAssetIds: [
          `stem-vocals-${input.requestId}`,
          `stem-drums-${input.requestId}`,
          `stem-bass-${input.requestId}`,
          `stem-other-${input.requestId}`,
        ],
      };

      this.logger.log(`Stem agent completed for request ${input.requestId}`);
      return result;
    } catch (err) {
      this.logger.error(`Stem agent failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}
