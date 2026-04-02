import {
  LeadQualificationClassification,
  LeadQualificationStageStatus,
} from './lead-qualification.model';

export interface LeadAnalysisStage {
  score: number | null;
  status: LeadQualificationStageStatus;
  reasons: string[];
}

export interface LeadAnalysis {
  id: string;
  leadId: string;
  topicId: string | null;
  relevance: LeadAnalysisStage;
  difficulty: LeadAnalysisStage;
  userFit: LeadAnalysisStage;
  finalScore: number | null;
  classification: LeadQualificationClassification;
  pipelineVersion: string;
  analyzedAt: Date;
}

export interface LeadAnalysisDto {
  leadId: string;
  topicId?: string | null;
  relevance?: Partial<LeadAnalysisStage>;
  difficulty?: Partial<LeadAnalysisStage>;
  userFit?: Partial<LeadAnalysisStage>;
  finalScore?: number | null;
  classification?: LeadQualificationClassification;
}
