import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
} from '../models';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FinanceService {
  private http = inject(HttpClient);
  private baseUrl = '/api/finance';

  private defined<T extends Record<string, unknown>>(value: T): T {
    return Object.fromEntries(
      Object.entries(value).filter(([, entry]) => entry !== undefined)
    ) as T;
  }

  private workspaceQuery(workspace?: FinanceWorkspace): string {
    return workspace ? `?workspace=${workspace}` : '';
  }

  private normalizeCategory(category: string | null | undefined): string {
    return category?.trim().toLowerCase() ?? '';
  }

  // Account methods
  async createAccount(account: CreateAccount): Promise<Account> {
    return firstValueFrom(
      this.http.post<Account>(`${this.baseUrl}/account`, account)
    );
  }

  async getAccount(id: string): Promise<Account> {
    return firstValueFrom(
      this.http.get<Account>(`${this.baseUrl}/account/${id}`)
    );
  }

  async getAccounts(workspace?: FinanceWorkspace): Promise<Account[]> {
    return firstValueFrom(
      this.http.get<Account[]>(
        `${this.baseUrl}/accounts${this.workspaceQuery(workspace)}`
      )
    );
  }

  async updateAccount(id: string, account: UpdateAccount): Promise<Account> {
    const payload = this.defined({
      name: account.name,
      type: account.type,
      balance: account.balance,
      description: account.description,
      isActive: account.isActive,
      workspace: account.workspace,
      lastReviewedAt: account.lastReviewedAt,
      providerConnectionId: account.providerConnectionId,
      providerAccountId: account.providerAccountId,
      institutionName: account.institutionName,
    });
    return firstValueFrom(
      this.http.put<Account>(`${this.baseUrl}/account/${id}`, payload)
    );
  }

  async deleteAccount(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/account/${id}`)
    );
  }

  // Transaction methods
  async createTransaction(
    transaction: CreateTransaction
  ): Promise<Transaction> {
    return firstValueFrom(
      this.http.post<Transaction>(`${this.baseUrl}/transaction`, transaction)
    );
  }

  async getTransaction(id: string): Promise<Transaction> {
    return firstValueFrom(
      this.http.get<Transaction>(`${this.baseUrl}/transaction/${id}`)
    );
  }

  async getTransactions(workspace?: FinanceWorkspace): Promise<Transaction[]> {
    return firstValueFrom(
      this.http.get<Transaction[]>(
        `${this.baseUrl}/transactions${this.workspaceQuery(workspace)}`
      )
    );
  }

  async getTransactionsByAccount(
    accountId: string,
    workspace?: FinanceWorkspace
  ): Promise<Transaction[]> {
    return firstValueFrom(
      this.http.get<Transaction[]>(
        `${this.baseUrl}/account/${accountId}/transactions${this.workspaceQuery(
          workspace
        )}`
      )
    );
  }

  async updateTransaction(
    id: string,
    transaction: UpdateTransaction
  ): Promise<Transaction> {
    const payload = this.defined({
      amount: transaction.amount,
      type: transaction.type,
      accountId: transaction.accountId,
      description: transaction.description,
      category: transaction.category,
      transactionDate: transaction.transactionDate,
      reference: transaction.reference,
      isRecurring: transaction.isRecurring,
      workspace: transaction.workspace,
      payeeOrVendor: transaction.payeeOrVendor,
      transferType: transaction.transferType,
      sourceType: transaction.sourceType,
      sourceProvider: transaction.sourceProvider,
      externalTransactionId: transaction.externalTransactionId,
      pending: transaction.pending,
      reviewStatus: transaction.reviewStatus,
    });
    return firstValueFrom(
      this.http.put<Transaction>(`${this.baseUrl}/transaction/${id}`, payload)
    );
  }

  async deleteTransaction(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/transaction/${id}`)
    );
  }

  async createBankLinkToken(input: {
    provider: string;
    redirectUri?: string;
  }): Promise<BankLinkTokenResponse> {
    return firstValueFrom(
      this.http.post<BankLinkTokenResponse>(`${this.baseUrl}/bank/link-token`, input)
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
      this.http.post<BankConnection>(`${this.baseUrl}/bank/connect`, input)
    );
  }

  async getBankConnections(): Promise<BankConnection[]> {
    return firstValueFrom(
      this.http.get<BankConnection[]>(`${this.baseUrl}/bank/connections`)
    );
  }

  async syncBankConnection(id: string): Promise<{
    added: number;
    modified: number;
    removed: number;
  }> {
    return firstValueFrom(
      this.http.post<{ added: number; modified: number; removed: number }>(
        `${this.baseUrl}/bank/connection/${id}/sync`,
        {}
      )
    );
  }

  async disconnectBankConnection(id: string): Promise<BankConnection> {
    return firstValueFrom(
      this.http.delete<BankConnection>(`${this.baseUrl}/bank/connection/${id}`)
    );
  }

  // Inventory Item methods
  async createInventoryItem(item: CreateInventoryItem): Promise<InventoryItem> {
    return firstValueFrom(
      this.http.post<InventoryItem>(`${this.baseUrl}/inventory-item`, item)
    );
  }

  async getInventoryItem(id: string): Promise<InventoryItem> {
    return firstValueFrom(
      this.http.get<InventoryItem>(`${this.baseUrl}/inventory-item/${id}`)
    );
  }

  async getInventoryItems(
    workspace?: FinanceWorkspace
  ): Promise<InventoryItem[]> {
    return firstValueFrom(
      this.http.get<InventoryItem[]>(
        `${this.baseUrl}/inventory-items${this.workspaceQuery(workspace)}`
      )
    );
  }

  async updateInventoryItem(
    id: string,
    item: UpdateInventoryItem
  ): Promise<InventoryItem> {
    const payload = this.defined({
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unitValue: item.unitValue,
      category: item.category,
      isActive: item.isActive,
      sku: item.sku,
      location: item.location,
      workspace: item.workspace,
    });
    return firstValueFrom(
      this.http.put<InventoryItem>(
        `${this.baseUrl}/inventory-item/${id}`,
        payload
      )
    );
  }

  async deleteInventoryItem(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/inventory-item/${id}`)
    );
  }

  // Budget methods
  async createBudget(budget: CreateBudget): Promise<Budget> {
    return firstValueFrom(
      this.http.post<Budget>(`${this.baseUrl}/budget`, budget)
    );
  }

  async getBudget(id: string): Promise<Budget> {
    return firstValueFrom(
      this.http.get<Budget>(`${this.baseUrl}/budget/${id}`)
    );
  }

  async getBudgets(workspace?: FinanceWorkspace): Promise<Budget[]> {
    const [budgets, transactions] = await Promise.all([
      firstValueFrom(
        this.http.get<Budget[]>(
          `${this.baseUrl}/budgets${this.workspaceQuery(workspace)}`
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
    const payload = this.defined({
      name: budget.name,
      category: budget.category,
      limit: budget.limit,
      period: budget.period,
      isActive: budget.isActive,
      alertOnExceed: budget.alertOnExceed,
      workspace: budget.workspace,
    });
    return firstValueFrom(
      this.http.put<Budget>(`${this.baseUrl}/budget/${id}`, payload)
    );
  }

  async deleteBudget(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/budget/${id}`)
    );
  }

  async getWorkspaceSummary(
    workspace: FinanceWorkspace
  ): Promise<FinanceWorkspaceSummary> {
    return firstValueFrom(
      this.http.get<FinanceWorkspaceSummary>(
        `${this.baseUrl}/summary/${workspace}`
      )
    );
  }

  async getWorkQueue(workspace: FinanceWorkspace): Promise<FinanceWorkQueue> {
    return firstValueFrom(
      this.http.get<FinanceWorkQueue>(`${this.baseUrl}/work-queue/${workspace}`)
    );
  }

  async getOnboardingState(): Promise<FinanceOnboardingState> {
    return firstValueFrom(
      this.http.get<FinanceOnboardingState>(`${this.baseUrl}/onboarding/state`)
    );
  }

  async bootstrapWorkspaces(
    workspaces: Array<'personal' | 'business'>
  ): Promise<FinanceOnboardingState> {
    return firstValueFrom(
      this.http.post<FinanceOnboardingState>(
        `${this.baseUrl}/onboarding/bootstrap`,
        {
          workspaces,
        }
      )
    );
  }

  async createRecurringItem(item: CreateRecurringItem): Promise<RecurringItem> {
    return firstValueFrom(
      this.http.post<RecurringItem>(`${this.baseUrl}/recurring-item`, item)
    );
  }

  async getRecurringItems(
    workspace?: FinanceWorkspace
  ): Promise<RecurringItem[]> {
    return firstValueFrom(
      this.http.get<RecurringItem[]>(
        `${this.baseUrl}/recurring-items${this.workspaceQuery(workspace)}`
      )
    );
  }

  async updateRecurringItem(
    id: string,
    item: UpdateRecurringItem
  ): Promise<RecurringItem> {
    const payload = this.defined({
      name: item.name,
      amount: item.amount,
      type: item.type,
      category: item.category,
      cadence: item.cadence,
      nextDueDate: item.nextDueDate,
      status: item.status,
      payeeOrVendor: item.payeeOrVendor,
      notes: item.notes,
      accountId: item.accountId,
      isActive: item.isActive,
      workspace: item.workspace,
    });
    return firstValueFrom(
      this.http.put<RecurringItem>(
        `${this.baseUrl}/recurring-item/${id}`,
        payload
      )
    );
  }

  async deleteRecurringItem(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/recurring-item/${id}`)
    );
  }

  async getCurrentTenant(): Promise<FinanceTenant> {
    return firstValueFrom(
      this.http.get<FinanceTenant>(`${this.baseUrl}/tenant/current`)
    );
  }

  async createTenant(input: {
    name: string;
    type?: FinanceAccountType;
  }): Promise<FinanceTenant> {
    return firstValueFrom(
      this.http.post<FinanceTenant>(`${this.baseUrl}/tenant`, input)
    );
  }

  async getTenants(): Promise<FinanceTenant[]> {
    return firstValueFrom(
      this.http.get<FinanceTenant[]>(`${this.baseUrl}/tenant`)
    );
  }

  async getTenantMembers(): Promise<FinanceTenantMember[]> {
    return firstValueFrom(
      this.http.get<FinanceTenantMember[]>(`${this.baseUrl}/tenant/members`)
    );
  }

  async getCategorySuggestions(
    workspace: FinanceWorkspace
  ): Promise<string[]> {
    const [transactions, budgets, recurringItems] = await Promise.all([
      this.getTransactions(workspace),
      this.getBudgets(workspace),
      workspace === 'net-worth' ? Promise.resolve([]) : this.getRecurringItems(workspace),
    ]);

    return Array.from(
      new Set(
        [...transactions, ...budgets, ...recurringItems]
          .map((item) => item.category?.trim())
          .filter((category): category is string => !!category)
      )
    ).sort((left, right) => left.localeCompare(right));
  }
}
