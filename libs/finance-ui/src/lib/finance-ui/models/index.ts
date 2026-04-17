export type FinanceWorkspace = 'personal' | 'business' | 'net-worth';

export type FinanceAccountType =
  | 'individual'
  | 'business'
  | 'nonprofit'
  | 'household';

export interface FinanceTenant {
  id: string;
  name: string;
  profileId: string;
  appScope: string;
  type?: FinanceAccountType;
}

export interface FinanceTenantMember {
  id: string;
  tenantId: string;
  profileId: string;
  role: string;
}

export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  userId: string;
  profileId: string;
  appScope: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  description?: string;
  workspace: FinanceWorkspace;
  lastReviewedAt?: Date;
  providerConnectionId?: string;
  providerAccountId?: string;
  institutionName?: string;
  syncStatus?: BankConnectionStatus;
  lastSyncedAt?: Date;
}

export interface CreateAccount {
  name: string;
  type: string;
  balance: number;
  currency: string;
  userId?: string;
  profileId?: string;
  appScope?: string;
  description?: string;
  workspace?: FinanceWorkspace;
  lastReviewedAt?: Date;
}

export interface UpdateAccount {
  name?: string;
  type?: string;
  balance?: number;
  description?: string;
  isActive?: boolean;
  workspace?: FinanceWorkspace;
  lastReviewedAt?: Date;
  providerConnectionId?: string;
  providerAccountId?: string;
  institutionName?: string;
}

export type BankConnectionStatus =
  | 'healthy'
  | 'needs-reauth'
  | 'sync-error'
  | 'disconnected';

export type BankSyncSourceType = 'manual' | 'import' | 'bank-sync';

export type BankTransactionReviewStatus = 'needs-review' | 'reviewed';

export interface LinkedBankAccount {
  id: string;
  connectionId: string;
  financeAccountId: string;
  providerAccountId: string;
  name: string;
  mask?: string;
  subtype?: string;
  providerType?: string;
  isActive: boolean;
}

export interface BankConnection {
  id: string;
  provider: string;
  status: BankConnectionStatus;
  institutionId?: string;
  institutionName?: string;
  lastError?: string;
  lastSuccessfulSyncAt?: Date;
  lastAttemptedSyncAt?: Date;
  isActive: boolean;
  linkedAccounts: LinkedBankAccount[];
}

export interface BankLinkTokenResponse {
  provider: string;
  linkToken: string;
  expiration?: string;
}

export interface Transaction {
  id: string;
  amount: number;
  type: string;
  category: string;
  description?: string;
  userId: string;
  profileId: string;
  appScope: string;
  accountId: string;
  transactionDate: Date;
  createdAt: Date;
  updatedAt: Date;
  reference?: string;
  isRecurring: boolean;
  workspace: FinanceWorkspace;
  payeeOrVendor?: string;
  transferType?: string;
  sourceType?: BankSyncSourceType;
  sourceProvider?: string;
  externalTransactionId?: string;
  pending?: boolean;
  reviewStatus?: BankTransactionReviewStatus;
}

export interface CreateTransaction {
  amount: number;
  type: string;
  category: string;
  description?: string;
  userId?: string;
  profileId?: string;
  appScope?: string;
  accountId: string;
  transactionDate?: Date;
  reference?: string;
  isRecurring?: boolean;
  workspace?: FinanceWorkspace;
  payeeOrVendor?: string;
  transferType?: string;
  sourceType?: BankSyncSourceType;
  sourceProvider?: string;
  externalTransactionId?: string;
  pending?: boolean;
  reviewStatus?: BankTransactionReviewStatus;
}

export interface UpdateTransaction {
  amount?: number;
  type?: string;
  accountId?: string;
  description?: string;
  category?: string;
  transactionDate?: Date;
  reference?: string;
  isRecurring?: boolean;
  workspace?: FinanceWorkspace;
  payeeOrVendor?: string;
  transferType?: string;
  sourceType?: BankSyncSourceType;
  sourceProvider?: string;
  externalTransactionId?: string;
  pending?: boolean;
  reviewStatus?: BankTransactionReviewStatus;
}

export interface InventoryItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  category: string;
  userId: string;
  profileId: string;
  appScope: string;
  sku?: string;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  workspace: FinanceWorkspace;
}

export interface CreateInventoryItem {
  name: string;
  description?: string;
  quantity: number;
  unitValue: number;
  category: string;
  userId?: string;
  profileId?: string;
  appScope?: string;
  sku?: string;
  location?: string;
  workspace?: FinanceWorkspace;
}

export interface UpdateInventoryItem {
  name?: string;
  description?: string;
  quantity?: number;
  unitValue?: number;
  category?: string;
  isActive?: boolean;
  sku?: string;
  location?: string;
  workspace?: FinanceWorkspace;
}

export interface Budget {
  id: string;
  name: string;
  category: string;
  limit: number;
  spent: number;
  period: string;
  startDate: Date;
  endDate: Date;
  userId: string;
  profileId: string;
  appScope: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  alertOnExceed: boolean;
  workspace: FinanceWorkspace;
}

export interface CreateBudget {
  name: string;
  category: string;
  limit: number;
  spent?: number;
  period: string;
  startDate: Date;
  endDate: Date;
  userId?: string;
  profileId?: string;
  appScope?: string;
  alertOnExceed?: boolean;
  workspace?: FinanceWorkspace;
}

export interface UpdateBudget {
  name?: string;
  category?: string;
  limit?: number;
  spent?: number;
  period?: string;
  isActive?: boolean;
  alertOnExceed?: boolean;
  workspace?: FinanceWorkspace;
}

export interface FinanceCoachCard {
  id: string;
  ruleId: string;
  title: string;
  message: string;
  explanation: string;
  whyItMatters: string;
  category: 'data-hygiene' | 'cash-pressure' | 'boundary-drift';
  severity: 'info' | 'warning' | 'action';
  actionLabel?: string;
  actionRoute?: string;
  entityRefs: Array<{
    entityType:
      | 'account'
      | 'transaction'
      | 'budget'
      | 'recurring-item'
      | 'asset';
    entityId: string;
  }>;
}

export interface FinanceSummaryMetrics {
  accountCount: number;
  budgetCount: number;
  totalBalance: number;
  monthlySpend: number;
  assetValue: number;
  liabilityValue: number;
  netWorth: number;
  budgetsAtRiskCount: number;
  upcomingRecurringCount: number;
}

export interface FinanceWorkspaceSummary {
  workspace: FinanceWorkspace;
  headline: string;
  metrics: FinanceSummaryMetrics;
  coachCards: FinanceCoachCard[];
}

export interface FinanceOnboardingChecklistItem {
  id: string;
  label: string;
  complete: boolean;
}

export interface FinanceOnboardingState {
  requiresOnboarding: boolean;
  availableWorkspaces: FinanceWorkspace[];
  checklist: FinanceOnboardingChecklistItem[];
}

export interface FinanceWorkQueue {
  workspace: FinanceWorkspace;
  items: FinanceCoachCard[];
}

export interface RecurringItem {
  id: string;
  name: string;
  amount: number;
  type: string;
  category?: string;
  cadence: string;
  nextDueDate: Date;
  status: string;
  payeeOrVendor?: string;
  notes?: string;
  accountId?: string;
  userId: string;
  profileId: string;
  appScope: string;
  workspace: FinanceWorkspace;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface CreateRecurringItem {
  name: string;
  amount: number;
  type: string;
  category?: string;
  cadence: string;
  nextDueDate: Date;
  status?: string;
  payeeOrVendor?: string;
  notes?: string;
  accountId?: string;
  userId?: string;
  profileId?: string;
  appScope?: string;
  workspace?: FinanceWorkspace;
}

export interface UpdateRecurringItem {
  name?: string;
  amount?: number;
  type?: string;
  category?: string;
  cadence?: string;
  nextDueDate?: Date;
  status?: string;
  payeeOrVendor?: string;
  notes?: string;
  accountId?: string;
  isActive?: boolean;
  workspace?: FinanceWorkspace;
}
