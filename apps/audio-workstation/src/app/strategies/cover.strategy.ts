import { Injectable } from '@nestjs/common';
import { CollaborationStrategy } from './collaboration-strategy.interface';
import { AIGenerationRequestEntity } from '../../entities/ai-generation-request.entity';

@Injectable()
export class CoverStrategy implements CollaborationStrategy {
  readonly mode = 'cover';

  buildPrompt(request: AIGenerationRequestEntity): string {
    const hasReference = request.referenceTrackAssetId ? 'yes' : 'no';
    const hasVocals = request.voiceMemoAssetId
      ? 'yes (user-provided vocals)'
      : 'no';

    return `[COVER MODE] The user is creating a cover version. They provide their own vocal performance and want the AI to generate an original instrumental arrangement around it, with minimal editing needed.\n\nUser's reference track available: ${hasReference}\nUser's vocal recording available: ${hasVocals}\n\nUser's direction: ${request.prompt}\n\nFollow this process:\n1. Analyze the reference track for chord progression, structure, and style\n2. Generate a full instrumental arrangement (drums, bass, chords, melody, pads) that supports the user's vocals\n3. Ensure the arrangement complements the vocal timing and key\n4. Apply professional mixing that centers the vocals\n5. Master for a polished sound`;
  }

  buildParameters(request: AIGenerationRequestEntity): Record<string, unknown> {
    return {
      ...request.parameters,
      referenceTrackId: request.referenceTrackAssetId,
      voiceMemoId: request.voiceMemoAssetId,
      centerVocals: true,
      preserveOriginalStructure: true,
      autoMix: true,
      autoMaster: true,
      stemCount: 5,
      vocalDucking: true,
    };
  }

  determineAgents(): string[] {
    return ['compose', 'mix', 'master'];
  }
}
