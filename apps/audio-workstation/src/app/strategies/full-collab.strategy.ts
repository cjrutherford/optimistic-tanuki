import { Injectable } from '@nestjs/common';
import { CollaborationStrategy } from './collaboration-strategy.interface';
import { AIGenerationRequestEntity } from '../../entities/ai-generation-request.entity';

@Injectable()
export class FullCollabStrategy implements CollaborationStrategy {
  readonly mode = 'full-collab';

  buildPrompt(request: AIGenerationRequestEntity): string {
    const hasVocals = request.voiceMemoAssetId
      ? 'yes (user-provided recording)'
      : 'no';
    const params = request.parameters || {};

    const instructions = [
      `Genre: ${params['genre'] || 'not specified'}`,
      `Mood: ${params['mood'] || 'not specified'}`,
      `BPM: ${params['bpm'] || 'automatic'}`,
      `Key: ${params['key'] || 'automatic'}`,
    ]
      .filter(Boolean)
      .join('\n');

    return `[FULL-COLLABORATION MODE] The user is in full creative control and wants the AI to act as an intelligent production assistant — augmenting their ideas rather than leading. The AI should suggest, generate options, and fill in gaps, but always defer to the user's creative decisions.\n\nUser's direction: ${request.prompt}\nUser provided recording: ${hasVocals}\n\nParameters:\n${instructions}\n\nFollow this process:\n1. Offer multiple variations/options for the user to choose from\n2. Generate a draft arrangement based on the user's direction\n3. Present stems as individual, editable components\n4. The user will refine through conversation — respond to specific requests for changes\n5. Do NOT apply mix/master without explicit user approval — instead suggest mix ideas and wait for confirmation`;
  }

  buildParameters(request: AIGenerationRequestEntity): Record<string, unknown> {
    return {
      ...request.parameters,
      voiceMemoId: request.voiceMemoAssetId,
      autoMix: false,
      autoMaster: false,
      stemCount: 5,
      generateOptions: 3,
      requireUserApproval: true,
      creativity: 0.6,
    };
  }

  determineAgents(_request?: AIGenerationRequestEntity): string[] {
    return ['compose', 'mix', 'master'];
  }
}
