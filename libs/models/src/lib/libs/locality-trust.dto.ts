export type LocalitySource = 'live-playback';

export type LocalityAssessmentStatus = 'unverified' | 'observed' | 'suspicious';

export interface LocalityObservationInputDto {
  subjectId: string;
  source: LocalitySource;
  lat: number;
  lng: number;
  accuracyMeters?: number;
  observedAt: string;
}

export interface LocalityObservationStateDto {
  subjectId: string;
  source: LocalitySource;
  lat: number;
  lng: number;
  observedAt: string;
}

export interface LocalityAssessmentDto {
  status: LocalityAssessmentStatus;
  confidenceScore: number;
  reasons: string[];
  observedAt: string | null;
  action: 'observe';
}

export interface LocalityAssessmentQueryDto {
  subjectId: string;
  source: LocalitySource;
}
