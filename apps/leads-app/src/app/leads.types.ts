export enum LeadSource {
  UPWORK = 'upwork',
  LINKEDIN = 'linkedin',
  REFERRAL = 'referral',
  COLD = 'cold',
  LOCAL = 'local',
  OTHER = 'other',
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

export interface Lead {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
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
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  keywords: string[];
  lastRun?: Date;
  leadCount: number;
}

export interface CreateLeadDto {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
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
  source?: LeadSource;
  status?: LeadStatus;
  value?: number;
  notes?: string;
  nextFollowUp?: string;
  isAutoDiscovered?: boolean;
  searchKeywords?: string[];
  assignedTo?: string;
}
