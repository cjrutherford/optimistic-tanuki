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
