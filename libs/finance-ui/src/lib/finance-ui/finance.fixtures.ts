import type {
  Account,
  BankConnection,
  Budget,
  FinanceOnboardingState,
  FinanceWorkQueue,
  FinanceWorkspaceSummary,
  FinancialCheckoutSession,
  FinancialInvoice,
  InventoryItem,
  RecurringItem,
  Transaction,
} from './models';

/** Sample finance data for Storybook stories. */
const at = (d: number) => new Date(Date.UTC(2026, 8, d, 15));
const owner = {
  userId: 'user-1',
  profileId: 'profile-1',
  appScope: 'fin-commander',
};

export const sampleAccounts: Account[] = [
  {
    ...owner,
    id: 'acct-checking',
    name: 'Everyday checking',
    type: 'checking',
    balance: 4210.55,
    currency: 'USD',
    createdAt: at(1),
    updatedAt: at(13),
    isActive: true,
    workspace: 'personal',
    institutionName: 'Harbor Credit Union',
    syncStatus: 'healthy',
    lastSyncedAt: at(14),
  },
  {
    ...owner,
    id: 'acct-savings',
    name: 'Emergency fund',
    type: 'savings',
    balance: 12500,
    currency: 'USD',
    createdAt: at(1),
    updatedAt: at(10),
    isActive: true,
    workspace: 'personal',
  },
  {
    ...owner,
    id: 'acct-card',
    name: 'Travel card',
    type: 'credit',
    balance: -842.1,
    currency: 'USD',
    createdAt: at(2),
    updatedAt: at(12),
    isActive: true,
    workspace: 'personal',
    institutionName: 'Northwind Bank',
    syncStatus: 'sync-error',
  },
];

export const sampleBankConnections: BankConnection[] = [
  {
    id: 'conn-1',
    provider: 'plaid',
    status: 'healthy',
    institutionName: 'Harbor Credit Union',
    lastSuccessfulSyncAt: at(14),
    isActive: true,
    linkedAccounts: [],
  },
  {
    id: 'conn-2',
    provider: 'plaid',
    status: 'sync-error',
    institutionName: 'Northwind Bank',
    lastError: 'The bank asked you to sign in again.',
    isActive: true,
    linkedAccounts: [],
  },
];

const txn = (
  id: string,
  amount: number,
  category: string,
  payee: string,
  d: number,
  extra: Partial<Transaction> = {}
): Transaction => ({
  ...owner,
  id,
  amount,
  type: amount < 0 ? 'expense' : 'income',
  category,
  description: payee,
  accountId: 'acct-checking',
  transactionDate: at(d),
  createdAt: at(d),
  updatedAt: at(d),
  isRecurring: false,
  workspace: 'personal',
  payeeOrVendor: payee,
  ...extra,
});

export const sampleTransactions: Transaction[] = [
  txn('txn-1', 3200, 'Salary', 'Coastal Ledger', 1),
  txn('txn-2', -1450, 'Housing', 'Riverside Apartments', 2, {
    isRecurring: true,
  }),
  txn('txn-3', -86.42, 'Groceries', 'Marsh Hen Market', 9, {
    sourceType: 'bank-sync',
    reviewStatus: 'needs-review',
  }),
  txn('txn-4', -54.99, 'Utilities', 'City Power', 11, {
    sourceType: 'bank-sync',
    reviewStatus: 'reviewed',
  }),
  txn('txn-5', -18.5, 'Dining', 'Corner Cafe', 13, {
    pending: true,
    sourceType: 'bank-sync',
    reviewStatus: 'needs-review',
  }),
];

export const sampleBudgets: Budget[] = [
  {
    ...owner,
    id: 'budget-groceries',
    name: 'Groceries',
    category: 'Groceries',
    limit: 600,
    spent: 412.3,
    period: 'monthly',
    startDate: at(1),
    endDate: at(30),
    createdAt: at(1),
    updatedAt: at(13),
    isActive: true,
    alertOnExceed: true,
    workspace: 'personal',
  },
  {
    ...owner,
    id: 'budget-dining',
    name: 'Dining out',
    category: 'Dining',
    limit: 200,
    spent: 231.75,
    period: 'monthly',
    startDate: at(1),
    endDate: at(30),
    createdAt: at(1),
    updatedAt: at(13),
    isActive: true,
    alertOnExceed: true,
    workspace: 'personal',
  },
];

export const sampleInventory: InventoryItem[] = [
  {
    ...owner,
    id: 'asset-bike',
    name: 'Road bike',
    quantity: 1,
    unitValue: 1400,
    totalValue: 1400,
    category: 'Vehicles',
    createdAt: at(1),
    updatedAt: at(1),
    isActive: true,
    workspace: 'net-worth',
  },
  {
    ...owner,
    id: 'asset-laptop',
    name: 'Work laptop',
    quantity: 1,
    unitValue: 2100,
    totalValue: 2100,
    category: 'Equipment',
    sku: 'LT-2026',
    createdAt: at(1),
    updatedAt: at(1),
    isActive: true,
    workspace: 'business',
  },
];

export const sampleRecurring: RecurringItem[] = [
  {
    ...owner,
    id: 'rec-rent',
    name: 'Rent',
    amount: 1450,
    type: 'expense',
    category: 'Housing',
    cadence: 'monthly',
    nextDueDate: at(30),
    status: 'active',
    payeeOrVendor: 'Riverside Apartments',
    workspace: 'personal',
    createdAt: at(1),
    updatedAt: at(1),
    isActive: true,
  },
  {
    ...owner,
    id: 'rec-internet',
    name: 'Internet',
    amount: 65,
    type: 'expense',
    category: 'Utilities',
    cadence: 'monthly',
    nextDueDate: at(18),
    status: 'active',
    workspace: 'personal',
    createdAt: at(1),
    updatedAt: at(1),
    isActive: true,
  },
];

export const sampleInvoices: FinancialInvoice[] = [
  {
    id: 'inv-1',
    invoiceNumber: 'INV-0041',
    customerName: 'Marsh Hen Bakery',
    customerEmail: 'hello@example.com',
    status: 'sent',
    currency: 'USD',
    subtotal: 900,
    total: 900,
    amountPaid: 0,
    workspace: 'business',
    dueDate: at(28),
    lines: [
      { description: 'Bookkeeping, September', quantity: 1, unitAmount: 900 },
    ],
  },
  {
    id: 'inv-2',
    invoiceNumber: 'INV-0038',
    customerName: 'Riverside Bike Works',
    status: 'overdue',
    currency: 'USD',
    subtotal: 450,
    total: 450,
    amountPaid: 150,
    workspace: 'business',
    dueDate: at(5),
    lines: [{ description: 'Quarterly filing', quantity: 1, unitAmount: 450 }],
  },
];

export const sampleCheckoutSessions: FinancialCheckoutSession[] = [
  {
    id: 'chk-1',
    invoiceId: 'inv-1',
    amount: 900,
    currency: 'USD',
    customerName: 'Marsh Hen Bakery',
    status: 'open',
    providerCheckoutUrl: 'https://example.com/checkout/chk-1',
    workspace: 'business',
  },
];

export const sampleSummary: FinanceWorkspaceSummary = {
  workspace: 'personal',
  headline: 'Spending is steady; dining is over budget this month.',
  metrics: {
    accountCount: 3,
    budgetCount: 2,
    totalBalance: 15868.45,
    monthlySpend: 1655.91,
    assetValue: 3500,
    liabilityValue: 842.1,
    netWorth: 18526.35,
    budgetsAtRiskCount: 1,
    upcomingRecurringCount: 2,
  },
  coachCards: [
    {
      id: 'coach-1',
      ruleId: 'budget-exceeded',
      title: 'Dining is over budget',
      message: 'You have spent $231.75 of $200.',
      explanation: 'Seven dining transactions this month.',
      whyItMatters: 'Overruns compound across the year.',
      category: 'cash-pressure',
      severity: 'warning',
      actionLabel: 'Review dining',
      entityRefs: [{ entityType: 'budget', entityId: 'budget-dining' }],
    },
    {
      id: 'coach-2',
      ruleId: 'needs-review',
      title: 'Two transactions need review',
      message: 'Imported transactions have not been categorised.',
      explanation: 'Bank sync imported them overnight.',
      whyItMatters: 'Uncategorised spending hides budget drift.',
      category: 'data-hygiene',
      severity: 'action',
      actionLabel: 'Review now',
      entityRefs: [{ entityType: 'transaction', entityId: 'txn-3' }],
    },
  ],
};

export const sampleWorkQueue: FinanceWorkQueue = {
  workspace: 'personal',
  items: sampleSummary.coachCards,
};

export const sampleOnboarding: FinanceOnboardingState = {
  requiresOnboarding: false,
  availableWorkspaces: ['personal', 'business', 'net-worth'],
  checklist: [
    { id: 'accounts', label: 'Add your accounts', complete: true },
    { id: 'budgets', label: 'Set a first budget', complete: true },
    { id: 'recurring', label: 'Record recurring bills', complete: false },
  ],
};

/** A FinanceService stand-in that resolves with the sample data. */
export class StoryFinanceService {
  getAccounts = async () => sampleAccounts;
  getBankConnections = async () => sampleBankConnections;
  syncBankConnection = async () => ({ imported: 0 });
  disconnectBankConnection = async () => sampleBankConnections[0];
  createBankLinkToken = async () => ({
    provider: 'plaid',
    linkToken: 'story-token',
  });
  connectBankProvider = async () => sampleBankConnections[0];
  createAccount = async () => sampleAccounts[0];
  updateAccount = async () => sampleAccounts[0];
  deleteAccount = async () => undefined;
  getTransactions = async () => sampleTransactions;
  createTransaction = async () => sampleTransactions[0];
  updateTransaction = async () => sampleTransactions[0];
  deleteTransaction = async () => undefined;
  getCategorySuggestions = async () => [
    'Groceries',
    'Dining',
    'Housing',
    'Utilities',
    'Salary',
  ];
  getBudgets = async () => sampleBudgets;
  createBudget = async () => sampleBudgets[0];
  updateBudget = async () => sampleBudgets[0];
  deleteBudget = async () => undefined;
  getInventoryItems = async () => sampleInventory;
  createInventoryItem = async () => sampleInventory[0];
  updateInventoryItem = async () => sampleInventory[0];
  deleteInventoryItem = async () => undefined;
  getRecurringItems = async () => sampleRecurring;
  createRecurringItem = async () => sampleRecurring[0];
  updateRecurringItem = async () => sampleRecurring[0];
  deleteRecurringItem = async () => undefined;
  getInvoices = async () => sampleInvoices;
  createInvoice = async () => sampleInvoices[0];
  getCheckoutSessions = async () => sampleCheckoutSessions;
  createCheckoutSession = async () => sampleCheckoutSessions[0];
  getWorkspaceSummary = async () => sampleSummary;
  getWorkQueue = async () => sampleWorkQueue;
  getOnboardingState = async () => sampleOnboarding;
}
