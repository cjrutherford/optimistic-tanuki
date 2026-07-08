import { Injectable, Logger } from '@nestjs/common';
import {
  AudioAgent,
  AudioAgentInput,
  AudioAgentOutput,
} from './audio-agent.interface';

@Injectable()
export class ComposerAgent implements AudioAgent {
  readonly name = 'compose';
  private readonly logger = new Logger(ComposerAgent.name);

  async execute(input: AudioAgentInput): Promise<AudioAgentOutput> {
    this.logger.log(`Composer agent executing for request ${input.requestId}`);

    try {
      const params = input.parameters as Record<string, unknown>;
      const isFullAuto = params['autoMix'] === true;
      const isCover = params['centerVocals'] === true;
      const generateOptions = (params['generateOptions'] as number) || 1;

      // Build the enriched prompt for the music generation model
      const enrichedPrompt = this.buildEnrichedPrompt(input, params);

      this.logger.debug(
        `Enriched prompt: ${enrichedPrompt.substring(0, 200)}...`
      );

      // In production, this would call the Ollama-hosted MusicGen model
      // via the prompt-proxy service. For now, returns a structured result.
      const result: AudioAgentOutput = {
        success: true,
        trackAssetIds: [
          `generated-drums-${input.requestId}`,
          `generated-bass-${input.requestId}`,
          `generated-chords-${input.requestId}`,
          `generated-melody-${input.requestId}`,
          `generated-pads-${input.requestId}`,
        ],
      };

      this.logger.log(
        `Composer agent completed for request ${input.requestId}`
      );
      return result;
    } catch (err) {
      this.logger.error(`Composer agent failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  private buildEnrichedPrompt(
    input: AudioAgentInput,
    params: Record<string, unknown>
  ): string {
    const parts: string[] = [input.prompt];
    if (params['genre']) parts.push(`Genre: ${params['genre']}`);
    if (params['mood']) parts.push(`Mood: ${params['mood']}`);
    if (params['bpm']) parts.push(`BPM: ${params['bpm']}`);
    if (params['key']) parts.push(`Key: ${params['key']}`);
    if (params['duration'])
      parts.push(`Duration: ${params['duration']} seconds`);
    if (params['structure']) parts.push(`Structure: ${params['structure']}`);
    return parts.join('\n');
  }
}
