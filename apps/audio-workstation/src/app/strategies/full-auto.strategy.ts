import { Injectable } from '@nestjs/common';
import { CollaborationStrategy } from './collaboration-strategy.interface';
import { AIGenerationRequestEntity } from '../../entities/ai-generation-request.entity';

@Injectable()
export class FullAutoStrategy implements CollaborationStrategy {
  readonly mode = 'full-auto';

  buildPrompt(request: AIGenerationRequestEntity): string {
    const params = request.parameters || {};
    const structure = [
      `Genre: ${params['genre'] || 'not specified'}`,
      `Mood: ${params['mood'] || 'not specified'}`,
      `BPM: ${params['bpm'] || 'automatic'}`,
      `Key: ${params['key'] || 'automatic'}`,
      params['duration'] ? `Duration: ${params['duration']} seconds` : '',
      params['structure'] ? `Structure: ${params['structure']}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return `[FULL-AUTO MODE] The user has provided a creative direction and wants the AI to handle everything from composition through mastering. Generate a complete, release-ready track.\n\nUser's direction:\n${request.prompt}\n\nParameters:\n${structure}\n\nGenerate a full arrangement with all stems (drums, bass, chords, melody, pads/fx). After composition, apply appropriate mixing and mastering for a polished result.`;
  }

  buildParameters(request: AIGenerationRequestEntity): Record<string, unknown> {
    return {
      ...request.parameters,
      autoMix: true,
      autoMaster: true,
      stemCount: 5,
      creativity: 0.8,
    };
  }

  determineAgents(): string[] {
    return ['compose', 'mix', 'master'];
  }
}
