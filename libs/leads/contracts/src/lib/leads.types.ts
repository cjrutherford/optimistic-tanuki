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

export enum LeadDiscoverySource {
  REMOTE_OK = 'remoteok',
  HIMALAYAS = 'himalayas',
  WE_WORK_REMOTELY = 'weworkremotely',
  JUST_REMOTE = 'justremote',
  JOBICY = 'jobicy',
  CLUTCH = 'clutch',
  CRUNCHBASE = 'crunchbase',
  INDEED = 'indeed',
  GOOGLE_MAPS = 'google-maps',
}

export enum LeadTopicDiscoveryIntent {
  JOB_OPENINGS = 'job-openings',
  SERVICE_BUYERS = 'service-buyers',
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

export enum LeadFlagReason {
  IRRELEVANT = 'irrelevant',
  DUPLICATE = 'duplicate',
  BAD_CONTACT_INFO = 'bad_contact_info',
  WRONG_INDUSTRY = 'wrong_industry',
  SPAM = 'spam',
  NOT_DECISION_MAKER = 'not_decision_maker',
  COMPANY_TOO_SMALL = 'company_too_small',
  COMPANY_TOO_LARGE = 'company_too_large',
  OTHER = 'other',
}

export const FLAG_REASON_LABELS: Record<LeadFlagReason, string> = {
  [LeadFlagReason.IRRELEVANT]: 'Irrelevant',
  [LeadFlagReason.DUPLICATE]: 'Duplicate',
  [LeadFlagReason.BAD_CONTACT_INFO]: 'Bad Contact Info',
  [LeadFlagReason.WRONG_INDUSTRY]: 'Wrong Industry',
  [LeadFlagReason.SPAM]: 'Spam / Junk',
  [LeadFlagReason.NOT_DECISION_MAKER]: 'Not Decision Maker',
  [LeadFlagReason.COMPANY_TOO_SMALL]: 'Company Too Small',
  [LeadFlagReason.COMPANY_TOO_LARGE]: 'Company Too Large',
  [LeadFlagReason.OTHER]: 'Other',
};

export interface LeadFlag {
  id: string;
  leadId: string;
  reasons: LeadFlagReason[];
  notes?: string;
  createdAt: Date;
}

export interface LeadContactPoint {
  kind: 'email' | 'phone' | 'link';
  value: string;
  href: string;
  label: string;
  source: 'provider' | 'posting-page';
  isPrimary: boolean;
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
  isFlagged?: boolean;
  flags?: LeadFlag[];
  createdAt: Date;
  updatedAt: Date;
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

export interface LeadQualificationSummary {
  byClassification: {
    'strong-match': number;
    review: number;
    'weak-match': number;
  };
  averageRelevanceScore: number | null;
  averageDifficultyScore: number | null;
  averageUserFitScore: number | null;
  missingUserFitCount: number;
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  keywords: string[];
  excludedTerms: string[];
  discoveryIntent: LeadTopicDiscoveryIntent;
  sources?: LeadDiscoverySource[];
  googleMapsCities?: string[] | null;
  googleMapsTypes?: string[] | null;
  googleMapsLocation?: string | null;
  googleMapsRadiusMiles?: number | null;
  lastRun?: Date;
  leadCount: number;
  qualificationSummary?: LeadQualificationSummary;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateLeadDto {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  originalPostingUrl?: string;
  source: LeadSource;
  status?: LeadStatus;
  value?: number;
  notes?: string;
  nextFollowUp?: string;
  isAutoDiscovered?: boolean;
  searchKeywords?: string[];
  assignedTo?: string;
}

export interface UpdateLeadDto {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  originalPostingUrl?: string;
  source?: LeadSource;
  status?: LeadStatus;
  value?: number;
  notes?: string;
  nextFollowUp?: string;
  isAutoDiscovered?: boolean;
  searchKeywords?: string[];
  assignedTo?: string;
}

export interface CreateLeadFlagDto {
  reasons: LeadFlagReason[];
  notes?: string;
}

export interface CreateTopicDto {
  name: string;
  description?: string;
  keywords: string[];
  excludedTerms?: string[];
  discoveryIntent?: LeadTopicDiscoveryIntent;
  sources?: LeadDiscoverySource[];
  googleMapsCities?: string[];
  googleMapsTypes?: string[];
  googleMapsLocation?: string;
  googleMapsRadiusMiles?: number;
  enabled?: boolean;
  lastRun?: string;
  leadCount?: number;
}

export interface UpdateTopicDto {
  name?: string;
  description?: string;
  keywords?: string[];
  excludedTerms?: string[];
  discoveryIntent?: LeadTopicDiscoveryIntent;
  sources?: LeadDiscoverySource[];
  googleMapsCities?: string[];
  googleMapsTypes?: string[];
  googleMapsLocation?: string;
  googleMapsRadiusMiles?: number;
  enabled?: boolean;
  lastRun?: string;
  leadCount?: number;
}

export interface TopicDiscoveryProviderResult {
  providerName: string;
  status?: 'ok' | 'warning' | 'error' | 'skipped';
  candidateCount: number;
  queries: string[];
  warnings: string[];
  issues?: TopicDiscoveryIssue[];
}

export interface TopicDiscoveryIssue {
  type:
    | 'missing-credentials'
    | 'upstream-response'
    | 'provider-failure'
    | 'excluded-results'
    | 'no-results'
    | 'other';
  severity: 'info' | 'success' | 'warning' | 'error';
  summary: string;
  detail: string;
  action?: string;
}

export interface TopicDiscoveryDiagnosticCounts {
  errors: number;
  warnings: number;
  providersWithIssues: number;
}

export interface TopicDiscoveryResult {
  topicId: string;
  linkedLeadCount: number;
  addedCount: number;
  removedCount: number;
  queued: boolean;
  status: 'idle' | 'queued' | 'running' | 'completed' | 'failed' | 'skipped';
  skipped?: boolean;
  lastRun?: string;
  message?: string;
  severity?: 'info' | 'success' | 'warning' | 'error';
  summaryTitle?: string;
  summaryBody?: string;
  actionItems?: string[];
  diagnosticCounts?: TopicDiscoveryDiagnosticCounts;
  providerResults?: TopicDiscoveryProviderResult[];
}
