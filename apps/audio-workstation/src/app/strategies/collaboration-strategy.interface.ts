import { AIGenerationRequestEntity } from '../../entities/ai-generation-request.entity';

export interface CollaborationStrategy {
  readonly mode: string;
  buildPrompt(request: AIGenerationRequestEntity): string;
  buildParameters(request: AIGenerationRequestEntity): Record<string, unknown>;
  determineAgents(): string[];
}
