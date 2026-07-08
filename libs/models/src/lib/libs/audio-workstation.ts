export type TrackType =
  | 'vocal'
  | 'drum'
  | 'bass'
  | 'guitar'
  | 'synth'
  | 'pad'
  | 'fx'
  | 'other';
export type AgentType = 'compose' | 'stem' | 'mix' | 'master';
export type GenerationStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';
export type CollaborationMode = 'full-auto' | 'cover' | 'full-collab';
export type ExportFormat = 'wav' | 'mp3' | 'flac';

export interface EqSettings {
  lowGain?: number;
  midGain?: number;
  highGain?: number;
  lowFreq?: number;
  highFreq?: number;
}

export interface DynamicsSettings {
  threshold?: number;
  ratio?: number;
  knee?: number;
  attack?: number;
  release?: number;
}

export interface EffectsSettings {
  reverbMix?: number;
  reverbDecay?: number;
  delayMix?: number;
  delayTime?: number;
  delayFeedback?: number;
}

export interface CreateAudioProjectDto {
  name: string;
  bpm?: number;
  key?: string;
  timeSignature?: string;
  genre?: string;
  mood?: string;
}

export interface UpdateAudioProjectDto {
  name?: string;
  bpm?: number;
  key?: string;
  timeSignature?: string;
  genre?: string;
  mood?: string;
}

export interface CreateTrackDto {
  projectId: string;
  name: string;
  type: TrackType;
  assetId?: string;
  volume?: number;
  pan?: number;
  sortOrder?: number;
}

export interface UpdateTrackDto {
  name?: string;
  volume?: number;
  pan?: number;
  muted?: boolean;
  solo?: boolean;
  sortOrder?: number;
}

export interface RequestGenerationDto {
  projectId: string;
  collaborationMode: CollaborationMode;
  prompt?: string;
  voiceMemoAssetId?: string;
  referenceTrackAssetId?: string;
  parameters?: {
    bpm?: number;
    key?: string;
    genre?: string;
    mood?: string;
    duration?: number;
    structure?: string;
  };
}

export interface SaveMixDto {
  projectId: string;
  trackId: string;
  volume: number;
  pan: number;
  eq: EqSettings;
  dynamics: DynamicsSettings;
  effects: EffectsSettings;
}

export interface StartExportDto {
  projectId: string;
  format: ExportFormat;
  quality?: 'low' | 'medium' | 'high' | 'custom';
  bitrate?: number;
  bitDepth?: 16 | 24;
  sampleRate?: 44100 | 48000;
  includeStems?: boolean;
}

export interface MasterAnalysis {
  integratedLufs: number;
  shortTermLufs: number;
  dynamicRange: number;
  peakDb: number;
  spectralBalance: 'dark' | 'neutral' | 'bright';
  recommendedTarget: number;
}

export interface TrackDto {
  id: string;
  projectId: string;
  name: string;
  type: TrackType;
  assetId: string | null;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  sortOrder: number;
  waveformDataUrl: string | null;
}

export interface AudioProjectDto {
  id: string;
  name: string;
  userId: string;
  bpm: number;
  key: string;
  timeSignature: string;
  genre: string | null;
  mood: string | null;
  createdAt: string;
  updatedAt: string;
  tracks: TrackDto[];
}

export interface AIGenerationRequestDto {
  id: string;
  projectId: string;
  collaborationMode: CollaborationMode;
  agentType: AgentType;
  prompt: string;
  status: GenerationStatus;
  resultAssetId: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface MixSnapshotDto {
  id: string;
  projectId: string;
  trackId: string;
  volume: number;
  pan: number;
  eq: EqSettings;
  dynamics: DynamicsSettings;
  effects: EffectsSettings;
  updatedAt: string;
}

export interface ExportStatusDto {
  id: string;
  projectId: string;
  format: ExportFormat;
  status: GenerationStatus;
  assetId: string | null;
  errorMessage: string | null;
  createdAt: string;
}
