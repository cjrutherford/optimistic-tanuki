import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AccountCommands,
  TransactionCommands,
  InventoryItemCommands,
  BudgetCommands,
  RecurringItemCommands,
  FinanceSummaryCommands,
  FinanceTenantCommands,
  FinanceBankingCommands,
} from '@optimistic-tanuki/constants';
import {
  BankConnectionCreateDto,
  BankConnectionExchangeDto,
  BankConnectionLinkTokenDto,
  BootstrapFinanceWorkspaceDto,
  CreateFinanceTenantDto,
  CreateAccountDto,
  UpdateAccountDto,
  CreateTransactionDto,
  UpdateTransactionDto,
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  CreateBudgetDto,
  CreateRecurringItemDto,
  FinanceWorkspace,
  UpdateRecurringItemDto,
  UpdateBudgetDto,
} from '@optimistic-tanuki/models';
import { AccountService } from './services/account.service';
import { TransactionService } from './services/transaction.service';
import { InventoryItemService } from './services/inventory-item.service';
import { BudgetService } from './services/budget.service';
import { FinanceSummaryService } from './services/finance-summary.service';
import { FindManyOptions } from 'typeorm';
import {
  Account,
  Transaction,
  InventoryItem,
  Budget,
  RecurringItem,
} from '../entities';
import { extractFinanceScope, FinanceScope } from './services/finance-scope';
import { RecurringItemService } from './services/recurring-item.service';
import { FinanceTenantService } from './services/finance-tenant.service';
import { BankConnectionService } from './services/bank-connection.service';

@Controller()
export class AppController {
  constructor(
    private readonly accountService: AccountService,
    private readonly transactionService: TransactionService,
    private readonly inventoryItemService: InventoryItemService,
    private readonly budgetService: BudgetService,
    private readonly financeSummaryService: FinanceSummaryService,
    private readonly recurringItemService: RecurringItemService,
    private readonly financeTenantService: FinanceTenantService,
    private readonly bankConnectionService: BankConnectionService
  ) {}

  private extractFindManyOptions<T>(
    payload?: FindManyOptions<T> & FinanceScope
  ): FindManyOptions<T> | undefined {
    if (!payload) {
      return undefined;
    }

    const { userId, profileId, appScope, ...options } =
      payload as FindManyOptions<T> & FinanceScope;
    return Object.keys(options).length ? options : undefined;
  }

  private async withResolvedTenant<
    T extends {
      userId?: string;
      profileId?: string;
      tenantId?: string;
      appScope?: string;
    }
  >(payload: T): Promise<T & { tenantId: string }> {
    if (payload.tenantId) {
      return payload as T & { tenantId: string };
    }

    const tenant = await this.financeTenantService.getCurrentTenant({
      userId: payload.userId,
      profileId: payload.profileId,
      tenantId: payload.tenantId,
      appScope: payload.appScope,
    });

    return {
      ...payload,
      tenantId: tenant.id,
    };
  }

  // Account endpoints
  @MessagePattern({ cmd: AccountCommands.CREATE })
  async createAccount(@Payload() data: CreateAccountDto) {
    return await this.accountService.create(
      await this.withResolvedTenant(data)
    );
  }

  @MessagePattern({ cmd: AccountCommands.FIND_MANY })
  async findAllAccounts(
    @Payload() payload?: FindManyOptions<Account> & FinanceScope
  ) {
    return await this.accountService.findAll(
      extractFinanceScope(payload as Record<string, unknown>),
      this.extractFindManyOptions(payload)
    );
  }

  @MessagePattern({ cmd: AccountCommands.FIND })
  async findOneAccount(@Payload() payload: { id: string } & FinanceScope) {
    return await this.accountService.findOne(
      payload.id,
      extractFinanceScope(payload as Record<string, unknown>)
    );
  }

  @MessagePattern({ cmd: AccountCommands.UPDATE })
  async updateAccount(
    @Payload() payload: { id: string; data: UpdateAccountDto } & FinanceScope
  ) {
    return await this.accountService.update(
      payload.id,
      payload.data,
      extractFinanceScope(payload as Record<string, unknown>)
    );
  }

  @MessagePattern({ cmd: AccountCommands.DELETE })
  async removeAccount(@Payload() payload: { id: string } & FinanceScope) {
    return await this.accountService.remove(
      payload.id,
      extractFinanceScope(payload as Record<string, unknown>)
    );
  }

  // Transaction endpoints
  @MessagePattern({ cmd: TransactionCommands.CREATE })
  async createTransaction(@Payload() data: CreateTransactionDto) {
    return await this.transactionService.create(
      await this.withResolvedTenant(data)
    );
  }

  @MessagePattern({ cmd: TransactionCommands.FIND_MANY })
  async findAllTransactions(
    @Payload() payload?: FindManyOptions<Transaction> & FinanceScope
  ) {
    return await this.transactionService.findAll(
      extractFinanceScope(payload as Record<string, unknown>),
      this.extractFindManyOptions(payload)
    );
  }

  @MessagePattern({ cmd: TransactionCommands.FIND })
  async findOneTransaction(@Payload() payload: { id: string } & FinanceScope) {
    return await this.transactionService.findOne(
      payload.id,
      extractFinanceScope(payload as Record<string, unknown>)
    );
  }

  @MessagePattern({ cmd: TransactionCommands.UPDATE })
  async updateTransaction(
    @Payload()
    payload: { id: string; data: UpdateTransactionDto } & FinanceScope
  ) {
    return await this.transactionService.update(
      payload.id,
      payload.data,
      extractFinanceScope(payload as Record<string, unknown>)
    );
  }

  @MessagePattern({ cmd: TransactionCommands.DELETE })
  async removeTransaction(@Payload() payload: { id: string } & FinanceScope) {
    return await this.transactionService.remove(
      payload.id,
      extractFinanceScope(payload as Record<string, unknown>)
    );
  }

  @MessagePattern({ cmd: FinanceBankingCommands.CREATE_CONNECTION })
  async createBankConnection(@Payload() payload: BankConnectionCreateDto) {
    return this.bankConnectionService.createConnection(payload);
  }

  @MessagePattern({ cmd: FinanceBankingCommands.LIST_CONNECTIONS })
  async listBankConnections(@Payload() payload: FinanceScope) {
    return this.bankConnectionService.listConnections(
      extractFinanceScope(payload as Record<string, unknown>)
    );
  }

  @MessagePattern({ cmd: FinanceBankingCommands.SYNC_CONNECTION })
  async syncBankConnection(
    @Payload()
    payload: { connectionId: string; transactions?: CreateTransactionDto[] } & FinanceScope
  ) {
    return this.bankConnectionService.syncConnection(
      payload.connectionId,
      extractFinanceScope(payload as Record<string, unknown>),
      payload.transactions ?? []
    );
  }

  @MessagePattern({ cmd: FinanceBankingCommands.DISCONNECT_CONNECTION })
  async disconnectBankConnection(
    @Payload() payload: { connectionId: string } & FinanceScope
  ) {
    return this.bankConnectionService.disconnectConnection(
      payload.connectionId,
      extractFinanceScope(payload as Record<string, unknown>)
    );
  }

  @MessagePattern({ cmd: FinanceBankingCommands.CREATE_LINK_TOKEN })
  async createBankLinkToken(
    @Payload() payload: BankConnectionLinkTokenDto & FinanceScope
  ) {
    return this.bankConnectionService.createLinkToken(
      payload as BankConnectionLinkTokenDto & {
        userId: string;
        profileId: string;
      }
    );
  }

  @MessagePattern({ cmd: FinanceBankingCommands.EXCHANGE_PUBLIC_TOKEN })
  async exchangePublicToken(
    @Payload() payload: BankConnectionExchangeDto & FinanceScope
  ) {
    return this.bankConnectionService.exchangePublicToken(
      payload as BankConnectionExchangeDto & FinanceScope & { tenantId: string }
    );
  }

  @MessagePattern({ cmd: FinanceBankingCommands.PROCESS_WEBHOOK })
  async processBankWebhook(@Payload() payload: Record<string, unknown>) {
    return this.bankConnectionService.processWebhook(payload);
  }

  // Inventory Item endpoints
  @MessagePattern({ cmd: InventoryItemCommands.CREATE })
  async createInventoryItem(@Payload() data: CreateInventoryItemDto) {
    return await this.inventoryItemService.create(
      await this.withResolvedTenant(data)
    );
  }

  @MessagePattern({ cmd: InventoryItemCommands.FIND_MANY })
  async findAllInventoryItems(
    @Payload() payload?: FindManyOptions<InventoryItem> & FinanceScope
  ) {
    return await this.inventoryItemService.findAll(
      extractFinanceScope(payload as Record<string, unknown>),
      this.extractFindManyOptions(payload)
    );
  }

  @MessagePattern({ cmd: InventoryItemCommands.FIND })
  async findOneInventoryItem(
    @Payload() payload: { id: string } & FinanceScope
  ) {
    return await this.inventoryItemService.findOne(
      payload.id,
      extractFinanceScope(payload as Record<string, unknown>)
    );
  }

  @MessagePattern({ cmd: InventoryItemCommands.UPDATE })
  async updateInventoryItem(
    @Payload()
    payload: { id: string; data: UpdateInventoryItemDto } & FinanceScope
  ) {
    return await this.inventoryItemService.update(
      payload.id,
      payload.data,
      extractFinanceScope(payload as Record<string, unknown>)
    );
  }

  @MessagePattern({ cmd: InventoryItemCommands.DELETE })
  async removeInventoryItem(@Payload() payload: { id: string } & FinanceScope) {
    return await this.inventoryItemService.remove(
      payload.id,
      extractFinanceScope(payload as Record<string, unknown>)
    );
  }

  // Budget endpoints
  @MessagePattern({ cmd: BudgetCommands.CREATE })
  async createBudget(@Payload() data: CreateBudgetDto) {
    return await this.budgetService.create(await this.withResolvedTenant(data));
  }

  @MessagePattern({ cmd: BudgetCommands.FIND_MANY })
  async findAllBudgets(
    @Payload() payload?: FindManyOptions<Budget> & FinanceScope
  ) {
    return await this.budgetService.findAll(
      extractFinanceScope(payload as Record<string, unknown>),
      this.extractFindManyOptions(payload)
    );
  }

  @MessagePattern({ cmd: BudgetCommands.FIND })
  async findOneBudget(@Payload() payload: { id: string } & FinanceScope) {
    return await this.budgetService.findOne(
      payload.id,
      extractFinanceScope(payload as Record<string, unknown>)
    );
  }

  @MessagePattern({ cmd: BudgetCommands.UPDATE })
  async updateBudget(
    @Payload() payload: { id: string; data: UpdateBudgetDto } & FinanceScope
  ) {
    return await this.budgetService.update(
      payload.id,
      payload.data,
      extractFinanceScope(payload as Record<string, unknown>)
    );
  }

  @MessagePattern({ cmd: BudgetCommands.DELETE })
  async removeBudget(@Payload() payload: { id: string } & FinanceScope) {
    return await this.budgetService.remove(
      payload.id,
      extractFinanceScope(payload as Record<string, unknown>)
    );
  }

  @MessagePattern({ cmd: RecurringItemCommands.CREATE })
  async createRecurringItem(@Payload() data: CreateRecurringItemDto) {
    return await this.recurringItemService.create(
      await this.withResolvedTenant(data)
    );
  }

  @MessagePattern({ cmd: RecurringItemCommands.FIND_MANY })
  async findAllRecurringItems(
    @Payload() payload?: FindManyOptions<RecurringItem> & FinanceScope
  ) {
    return await this.recurringItemService.findAll(
      extractFinanceScope(payload as Record<string, unknown>),
      this.extractFindManyOptions(payload)
    );
  }

  @MessagePattern({ cmd: RecurringItemCommands.FIND })
  async findOneRecurringItem(
    @Payload() payload: { id: string } & FinanceScope
  ) {
    return await this.recurringItemService.findOne(
      payload.id,
      extractFinanceScope(payload as Record<string, unknown>)
    );
  }

  @MessagePattern({ cmd: RecurringItemCommands.UPDATE })
  async updateRecurringItem(
    @Payload()
    payload: { id: string; data: UpdateRecurringItemDto } & FinanceScope
  ) {
    return await this.recurringItemService.update(
      payload.id,
      payload.data,
      extractFinanceScope(payload as Record<string, unknown>)
    );
  }

  @MessagePattern({ cmd: RecurringItemCommands.DELETE })
  async removeRecurringItem(@Payload() payload: { id: string } & FinanceScope) {
    return await this.recurringItemService.remove(
      payload.id,
      extractFinanceScope(payload as Record<string, unknown>)
    );
  }

  @MessagePattern({ cmd: FinanceSummaryCommands.GET_WORKSPACE_SUMMARY })
  async getWorkspaceSummary(
    @Payload() payload: { workspace: FinanceWorkspace } & FinanceScope
  ) {
    return await this.financeSummaryService.getWorkspaceSummary(
      extractFinanceScope(payload as Record<string, unknown>) ?? {},
      payload.workspace
    );
  }

  @MessagePattern({ cmd: FinanceSummaryCommands.GET_WORK_QUEUE })
  async getWorkQueue(
    @Payload() payload: { workspace: FinanceWorkspace } & FinanceScope
  ) {
    return await this.financeSummaryService.getWorkQueue(
      extractFinanceScope(payload as Record<string, unknown>) ?? {},
      payload.workspace
    );
  }

  @MessagePattern({ cmd: FinanceSummaryCommands.GET_ONBOARDING_STATE })
  async getOnboardingState(@Payload() payload?: FinanceScope) {
    return await this.financeSummaryService.getOnboardingState(
      extractFinanceScope((payload as Record<string, unknown>) ?? {}) ?? {}
    );
  }

  @MessagePattern({ cmd: FinanceSummaryCommands.BOOTSTRAP })
  async bootstrapFinance(
    @Payload()
    payload: { data: BootstrapFinanceWorkspaceDto } & FinanceScope
  ) {
    return await this.financeSummaryService.bootstrap(
      extractFinanceScope(payload as Record<string, unknown>) ?? {},
      payload.data
    );
  }

  @MessagePattern({ cmd: FinanceTenantCommands.GET_CURRENT_TENANT })
  async getCurrentTenant(@Payload() payload?: FinanceScope) {
    return await this.financeTenantService.getCurrentTenant(
      extractFinanceScope((payload as Record<string, unknown>) ?? {}) ?? {}
    );
  }

  @MessagePattern({ cmd: FinanceTenantCommands.CREATE_TENANT })
  async createTenant(
    @Payload() payload: CreateFinanceTenantDto & FinanceScope
  ) {
    return await this.financeTenantService.createTenant({
      ...payload,
      profileId: payload.profileId,
      appScope: payload.appScope,
    });
  }

  @MessagePattern({ cmd: FinanceTenantCommands.LIST_TENANTS })
  async listTenants(@Payload() payload?: FinanceScope) {
    return await this.financeTenantService.listTenants(
      extractFinanceScope((payload as Record<string, unknown>) ?? {}) ?? {}
    );
  }

  @MessagePattern({ cmd: FinanceTenantCommands.LIST_TENANT_MEMBERS })
  async listTenantMembers(@Payload() payload?: FinanceScope) {
    return await this.financeTenantService.listMembers(
      extractFinanceScope((payload as Record<string, unknown>) ?? {}) ?? {}
    );
  }
}
