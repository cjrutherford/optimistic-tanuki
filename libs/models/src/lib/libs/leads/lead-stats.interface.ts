import { LeadQualificationClassification } from './lead-qualification.model';

export interface LeadQualificationSummary {
  byClassification: Record<LeadQualificationClassification, number>;
  averageRelevanceScore: number | null;
  averageDifficultyScore: number | null;
  averageUserFitScore: number | null;
  missingUserFitCount: number;
}

export interface LeadStats {
  total: number;
  autoDiscovered: number;
  manual: number;
  totalValue: number;
  followUpsDue: number;
  byStatus: Record<string, number>;
  qualification: LeadQualificationSummary;
}
