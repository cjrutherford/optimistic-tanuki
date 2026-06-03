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

export interface Lead {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  originalPostingUrl?: string;
  source: LeadSource | string;
  status: LeadStatus | string;
  value: number;
  notes: string;
  nextFollowUp?: string;
  isAutoDiscovered: boolean;
  searchKeywords?: string[];
  assignedTo?: string;
  appScope?: string;
  profileId?: string;
  userId?: string;
  contactSubject?: string;
  contactMessage?: string;
  contactSourceLabel?: string;
  lastRespondedAt?: string | Date | null;
  isFlagged?: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface UpdateLeadDto {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  originalPostingUrl?: string;
  source?: LeadSource | string;
  status?: LeadStatus | string;
  value?: number;
  notes?: string;
  nextFollowUp?: string;
  isAutoDiscovered?: boolean;
  searchKeywords?: string[];
  assignedTo?: string;
  contactSubject?: string;
  contactMessage?: string;
  contactSourceLabel?: string;
}

export interface SendLeadResponseDto {
  toEmail?: string;
  subject: string;
  message: string;
  status?: LeadStatus | string;
  nextFollowUp?: string;
}
