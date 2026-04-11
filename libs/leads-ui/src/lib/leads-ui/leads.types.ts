export enum LeadSource {
  REMOTE_OK = 'remoteok',
  HIMALAYAS = 'himalayas',
  WE_WORK_REMOTELY = 'weworkremotely',
  JUST_REMOTE = 'justremote',
  JOBICY = 'jobicy',
  CLUTCH = 'clutch',
  CRUNCHBASE = 'crunchbase',
  INDEED = 'indeed',
  GOOGLE_MAPS = 'google-maps',
  REFERRAL = 'referral',
  COLD = 'cold',
  OTHER = 'other',
  UPWORK = 'upwork',
  LINKEDIN = 'linkedin',
  LOCAL = 'local',
}

export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  QUALIFIED = 'qualified',
  PROPOSAL = 'proposal',
  NEGOTIATION = 'negotiation',
  WON = 'won',
  LOST = 'lost',
}

export interface LeadQualificationSummary {
  byClassification: Record<string, number>;
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

export interface LeadContactPoint {
  type: 'email' | 'phone';
  value: string;
  label?: string;
  source?: string;
  primary?: boolean;
}

export interface Lead {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  originalPostingUrl?: string;
  contacts?: LeadContactPoint[];
  source: LeadSource;
  status: LeadStatus;
  value: number;
  notes: string;
  nextFollowUp?: string;
  isAutoDiscovered: boolean;
  searchKeywords?: string[];
  assignedTo?: string;
  appScope: string;
  profileId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLeadDto {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  originalPostingUrl?: string;
  contacts?: LeadContactPoint[];
  source: LeadSource;
  status?: LeadStatus;
  value?: number;
  notes?: string;
  nextFollowUp?: string;
  isAutoDiscovered?: boolean;
  searchKeywords?: string[];
  assignedTo?: string;
}

export type UpdateLeadInput = Partial<CreateLeadDto>;
