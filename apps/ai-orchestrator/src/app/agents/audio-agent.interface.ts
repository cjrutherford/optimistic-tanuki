export interface AudioAgentInput {
  requestId: string;
  projectId: string;
  prompt: string;
  parameters: Record<string, unknown>;
  voiceMemoAssetId?: string;
  referenceTrackAssetId?: string;
}

export interface AudioAgentOutput {
  success: boolean;
  trackAssetIds?: string[];
  mixParameters?: Record<string, unknown>;
  masterAnalysis?: Record<string, unknown>;
  error?: string;
}

export interface AudioAgent {
  readonly name: string;
  execute(input: AudioAgentInput): Promise<AudioAgentOutput>;
}
