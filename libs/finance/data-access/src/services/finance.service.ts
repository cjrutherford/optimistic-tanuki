import { Injectable, inject } from '@angular/core';
import {
  Account,
  CreateAccount,
  UpdateAccount,
  Transaction,
  CreateTransaction,
  UpdateTransaction,
  InventoryItem,
  CreateInventoryItem,
  UpdateInventoryItem,
  Budget,
  BankConnection,
  BankLinkTokenResponse,
  CreateBudget,
  UpdateBudget,
  FinanceOnboardingState,
  FinanceAccountType,
  FinanceWorkQueue,
  FinanceWorkspace,
  FinanceWorkspaceSummary,
  RecurringItem,
  CreateRecurringItem,
  UpdateRecurringItem,
  FinanceTenant,
  FinanceTenantMember,
  FinancialCheckoutSession,
  FinancialInvoice,
  CreateFinancialCheckoutSession,
  CreateFinancialInvoice,
  RecordFinancialInvoicePayment,
  UpdateFinancialInvoice,
} from '../models';
import { OptomisitcTanukiAPIService } from '../generated/finance';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FinanceService {
  private finance = inject(OptomisitcTanukiAPIService);

  private workspaceParams(workspace?: FinanceWorkspace) {
    return workspace ? { workspace } : {};
  }

  private normalizeCategory(category: string | null | undefined): string {
    return category?.trim().toLowerCase() ?? '';
  }

  /** Domain models carry Dates; the wire wants ISO strings (identical bytes
   * to the old HttpClient JSON serialization). Non-Dates pass through so
   * malformed payloads still fail server-side, as before. */
  private wireDate(value: Date): string;
  private wireDate(value: undefined): undefined;
  private wireDate(value: Date | undefined): string | undefined;
  private wireDate(value: unknown): unknown {
    return value instanceof Date ? value.toISOString() : value;
  }

  // Account methods
  async createAccount(account: CreateAccount): Promise<Account> {
    return firstValueFrom(
      this.finance.financeControllerCreateAccount<Account>({
        ...account,
        lastReviewedAt: this.wireDate(account.lastReviewedAt),
      })
    );
  }

  async getAccount(id: string): Promise<Account> {
    return firstValueFrom(
      this.finance.financeControllerGetAccount<Account>(id)
    );
  }

  async getAccounts(workspace?: FinanceWorkspace): Promise<Account[]> {
    return firstValueFrom(
      this.finance.financeControllerGetAllAccounts<Account[]>(
        this.workspaceParams(workspace)
      )
    );
  }

  async updateAccount(id: string, account: UpdateAccount): Promise<Account> {
    // The old client pruned undefined fields; JSON serialization drops them
    // identically, so the DTO travels as-is apart from wire dates.
    const { lastReviewedAt, ...rest } = account;
    return firstValueFrom(
      this.finance.financeControllerUpdateAccount<Account>(id, {
        ...rest,
        lastReviewedAt:
          lastReviewedAt === undefined
            ? undefined
            : this.wireDate(lastReviewedAt),
      })
    );
  }

  async deleteAccount(id: string): Promise<void> {
    return firstValueFrom(
      this.finance.financeControllerDeleteAccount<void>(id)
    );
  }

  // Transaction methods
  async createTransaction(
    transaction: CreateTransaction
  ): Promise<Transaction> {
    // transactionDate/isRecurring are server-required but UI-optional: the
    // casts preserve the pass-through so missing values fail server-side,
    // as before (no fabrication).
    const { transactionDate, isRecurring, ...rest } = transaction;
    return firstValueFrom(
      this.finance.financeControllerCreateTransaction<Transaction>({
        ...rest,
        transactionDate: this.wireDate(transactionDate as Date),
        isRecurring: isRecurring as boolean,
      })
    );
  }

  async getTransaction(id: string): Promise<Transaction> {
    return firstValueFrom(
      this.finance.financeControllerGetTransaction<Transaction>(id)
    );
  }

  async getTransactions(workspace?: FinanceWorkspace): Promise<Transaction[]> {
    return firstValueFrom(
      this.finance.financeControllerGetAllTransactions<Transaction[]>(
        this.workspaceParams(workspace)
      )
    );
  }

  async getTransactionsByAccount(
    accountId: string,
    workspace?: FinanceWorkspace
  ): Promise<Transaction[]> {
    return firstValueFrom(
      this.finance.financeControllerGetTransactionsByAccount<Transaction[]>(
        accountId,
        this.workspaceParams(workspace)
      )
    );
  }

  async updateTransaction(
    id: string,
    transaction: UpdateTransaction
  ): Promise<Transaction> {
    const { transactionDate, ...rest } = transaction;
    return firstValueFrom(
      this.finance.financeControllerUpdateTransaction<Transaction>(id, {
        ...rest,
        transactionDate:
          transactionDate === undefined
            ? undefined
            : this.wireDate(transactionDate),
      })
    );
  }

  async deleteTransaction(id: string): Promise<void> {
    return firstValueFrom(
      this.finance.financeControllerDeleteTransaction<void>(id)
    );
  }

  async createBankLinkToken(input: {
    provider: string;
    redirectUri?: string;
  }): Promise<BankLinkTokenResponse> {
    return firstValueFrom(
      this.finance.financeControllerCreateBankLinkToken<BankLinkTokenResponse>(
        input
      )
    );
  }

  async connectBankProvider(input: {
    provider: string;
    publicToken: string;
    institutionId?: string;
    institutionName?: string;
    workspace?: FinanceWorkspace;
  }): Promise<BankConnection> {
    return firstValueFrom(
      this.finance.financeControllerConnectBankProvider<BankConnection>(input)
    );
  }

  async getBankConnections(): Promise<BankConnection[]> {
    return firstValueFrom(
      this.finance.financeControllerListBankConnections<BankConnection[]>()
    );
  }

  async syncBankConnection(id: string): Promise<{
    added: number;
    modified: number;
    removed: number;
  }> {
    return firstValueFrom(
      this.finance.financeControllerSyncBankConnection<{
        added: number;
        modified: number;
        removed: number;
      }>(id)
    );
  }

  async disconnectBankConnection(id: string): Promise<BankConnection> {
    return firstValueFrom(
      this.finance.financeControllerDisconnectBankConnection<BankConnection>(id)
    );
  }

  // Inventory Item methods
  async createInventoryItem(item: CreateInventoryItem): Promise<InventoryItem> {
    return firstValueFrom(
      this.finance.financeControllerCreateInventoryItem<InventoryItem>(item)
    );
  }

  async getInventoryItem(id: string): Promise<InventoryItem> {
    return firstValueFrom(
      this.finance.financeControllerGetInventoryItem<InventoryItem>(id)
    );
  }

  async getInventoryItems(
    workspace?: FinanceWorkspace
  ): Promise<InventoryItem[]> {
    return firstValueFrom(
      this.finance.financeControllerGetAllInventoryItems<InventoryItem[]>(
        this.workspaceParams(workspace)
      )
    );
  }

  async updateInventoryItem(
    id: string,
    item: UpdateInventoryItem
  ): Promise<InventoryItem> {
    return firstValueFrom(
      this.finance.financeControllerUpdateInventoryItem<InventoryItem>(id, item)
    );
  }

  async deleteInventoryItem(id: string): Promise<void> {
    return firstValueFrom(
      this.finance.financeControllerDeleteInventoryItem<void>(id)
    );
  }

  // Budget methods
  async createBudget(budget: CreateBudget): Promise<Budget> {
    // `spent` is server-required but UI-optional: the cast preserves the
    // pass-through so a missing value fails server-side, as before (no
    // fabrication).
    const { startDate, endDate, spent, alertOnExceed, ...rest } = budget;
    return firstValueFrom(
      this.finance.financeControllerCreateBudget<Budget>({
        ...rest,
        spent: spent as number,
        alertOnExceed: alertOnExceed as boolean,
        startDate: this.wireDate(startDate),
        endDate: this.wireDate(endDate),
      })
    );
  }

  async getBudget(id: string): Promise<Budget> {
    return firstValueFrom(this.finance.financeControllerGetBudget<Budget>(id));
  }

  async getBudgets(workspace?: FinanceWorkspace): Promise<Budget[]> {
    const [budgets, transactions] = await Promise.all([
      firstValueFrom(
        this.finance.financeControllerGetAllBudgets<Budget[]>(
          this.workspaceParams(workspace)
        )
      ),
      this.getTransactions(workspace),
    ]);

    return budgets.map((budget) => {
      const normalizedBudgetCategory = this.normalizeCategory(budget.category);
      const spent = transactions
        .filter(
          (transaction) =>
            transaction.type === 'debit' &&
            this.normalizeCategory(transaction.category) ===
              normalizedBudgetCategory
        )
        .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

      return {
        ...budget,
        spent,
      };
    });
  }

  async updateBudget(id: string, budget: UpdateBudget): Promise<Budget> {
    return firstValueFrom(
      this.finance.financeControllerUpdateBudget<Budget>(id, budget)
    );
  }

  async deleteBudget(id: string): Promise<void> {
    return firstValueFrom(this.finance.financeControllerDeleteBudget<void>(id));
  }

  async getWorkspaceSummary(
    workspace: FinanceWorkspace
  ): Promise<FinanceWorkspaceSummary> {
    return firstValueFrom(
      this.finance.financeControllerGetSummary<FinanceWorkspaceSummary>(
        workspace
      )
    );
  }

  async getWorkQueue(workspace: FinanceWorkspace): Promise<FinanceWorkQueue> {
    return firstValueFrom(
      this.finance.financeControllerGetWorkQueue<FinanceWorkQueue>(workspace)
    );
  }

  async getOnboardingState(): Promise<FinanceOnboardingState> {
    return firstValueFrom(
      this.finance.financeControllerGetOnboardingState<FinanceOnboardingState>()
    );
  }

  async bootstrapWorkspaces(
    workspaces: Array<'personal' | 'business'>
  ): Promise<FinanceOnboardingState> {
    return firstValueFrom(
      this.finance.financeControllerBootstrapWorkspaces<FinanceOnboardingState>(
        { workspaces }
      )
    );
  }

  async createRecurringItem(item: CreateRecurringItem): Promise<RecurringItem> {
    const { nextDueDate, ...rest } = item;
    return firstValueFrom(
      this.finance.financeControllerCreateRecurringItem<RecurringItem>({
        ...rest,
        nextDueDate: this.wireDate(nextDueDate),
      })
    );
  }

  async getRecurringItems(
    workspace?: FinanceWorkspace
  ): Promise<RecurringItem[]> {
    return firstValueFrom(
      this.finance.financeControllerGetAllRecurringItems<RecurringItem[]>(
        this.workspaceParams(workspace)
      )
    );
  }

  async updateRecurringItem(
    id: string,
    item: UpdateRecurringItem
  ): Promise<RecurringItem> {
    const { nextDueDate, ...rest } = item;
    return firstValueFrom(
      this.finance.financeControllerUpdateRecurringItem<RecurringItem>(id, {
        ...rest,
        nextDueDate:
          nextDueDate === undefined ? undefined : this.wireDate(nextDueDate),
      })
    );
  }

  async deleteRecurringItem(id: string): Promise<void> {
    return firstValueFrom(
      this.finance.financeControllerDeleteRecurringItem<void>(id)
    );
  }

  async getCurrentTenant(): Promise<FinanceTenant> {
    return firstValueFrom(
      this.finance.financeControllerGetCurrentTenant<FinanceTenant>()
    );
  }

  async createTenant(input: {
    name: string;
    type?: FinanceAccountType;
  }): Promise<FinanceTenant> {
    return firstValueFrom(
      this.finance.financeControllerCreateTenant<FinanceTenant>(input)
    );
  }

  async getTenants(): Promise<FinanceTenant[]> {
    return firstValueFrom(
      this.finance.financeControllerListTenants<FinanceTenant[]>()
    );
  }

  async getTenantMembers(): Promise<FinanceTenantMember[]> {
    return firstValueFrom(
      this.finance.financeControllerListTenantMembers<FinanceTenantMember[]>()
    );
  }

  async addTenantMember(input: {
    memberProfileId: string;
    role: 'finance_admin' | 'finance_member';
  }): Promise<FinanceTenantMember> {
    return firstValueFrom(
      this.finance.financeControllerCreateTenantMember<FinanceTenantMember>(
        input
      )
    );
  }

  async updateTenantMemberRole(
    memberId: string,
    role: 'finance_admin' | 'finance_member'
  ): Promise<FinanceTenantMember> {
    return firstValueFrom(
      this.finance.financeControllerUpdateTenantMember<FinanceTenantMember>(
        memberId,
        { role }
      )
    );
  }

  async removeTenantMember(memberId: string): Promise<void> {
    await firstValueFrom(
      this.finance.financeControllerRemoveTenantMember<void>(memberId)
    );
  }

  async getCategorySuggestions(workspace: FinanceWorkspace): Promise<string[]> {
    const [transactions, budgets, recurringItems] = await Promise.all([
      this.getTransactions(workspace),
      this.getBudgets(workspace),
      workspace === 'net-worth'
        ? Promise.resolve([])
        : this.getRecurringItems(workspace),
    ]);

    return Array.from(
      new Set(
        [...transactions, ...budgets, ...recurringItems]
          .map((item) => item.category?.trim())
          .filter((category): category is string => !!category)
      )
    ).sort((left, right) => left.localeCompare(right));
  }

  async getInvoices(workspace?: FinanceWorkspace): Promise<FinancialInvoice[]> {
    return firstValueFrom(
      this.finance.financeControllerListInvoices<FinancialInvoice[]>(
        this.workspaceParams(workspace)
      )
    );
  }

  async getInvoice(id: string): Promise<FinancialInvoice> {
    return firstValueFrom(
      this.finance.financeControllerGetInvoice<FinancialInvoice>(id)
    );
  }

  async createInvoice(
    invoice: CreateFinancialInvoice
  ): Promise<FinancialInvoice> {
    const { dueDate, ...rest } = invoice;
    return firstValueFrom(
      this.finance.financeControllerCreateInvoice<FinancialInvoice>({
        ...rest,
        dueDate: dueDate === undefined ? undefined : this.wireDate(dueDate),
      })
    );
  }

  async updateInvoice(
    id: string,
    invoice: UpdateFinancialInvoice
  ): Promise<FinancialInvoice> {
    const { dueDate, ...rest } = invoice;
    return firstValueFrom(
      this.finance.financeControllerUpdateInvoice<FinancialInvoice>(id, {
        ...rest,
        dueDate: dueDate === undefined ? undefined : this.wireDate(dueDate),
      })
    );
  }

  async sendInvoice(id: string): Promise<FinancialInvoice> {
    return firstValueFrom(
      this.finance.financeControllerSendInvoice<FinancialInvoice>(id)
    );
  }

  async voidInvoice(id: string): Promise<FinancialInvoice> {
    return firstValueFrom(
      this.finance.financeControllerVoidInvoice<FinancialInvoice>(id)
    );
  }

  async recordInvoicePayment(
    id: string,
    payment: RecordFinancialInvoicePayment
  ): Promise<FinancialInvoice> {
    const { paidAt, ...rest } = payment;
    return firstValueFrom(
      this.finance.financeControllerRecordInvoicePayment<FinancialInvoice>(id, {
        ...rest,
        paidAt: paidAt === undefined ? undefined : this.wireDate(paidAt),
      })
    );
  }

  async createCheckoutSession(
    session: CreateFinancialCheckoutSession
  ): Promise<FinancialCheckoutSession> {
    return firstValueFrom(
      this.finance.financeControllerCreateCheckoutSession<FinancialCheckoutSession>(
        session
      )
    );
  }

  async getCheckoutSessions(
    workspace?: FinanceWorkspace
  ): Promise<FinancialCheckoutSession[]> {
    return firstValueFrom(
      this.finance.financeControllerListCheckoutSessions<
        FinancialCheckoutSession[]
      >(this.workspaceParams(workspace))
    );
  }
}
