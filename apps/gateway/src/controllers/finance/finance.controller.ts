import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  HttpException,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ServiceTokens,
  AccountCommands,
  TransactionCommands,
  InventoryItemCommands,
  BudgetCommands,
  RecurringItemCommands,
  FinanceSummaryCommands,
  FinanceTenantCommands,
  FinanceBankingCommands,
  FinancialUtilitiesCommands,
  FinCommanderPlanCommands,
  FinCommanderGoalCommands,
  FinCommanderScenarioCommands,
  FinCommanderPlanDto,
  UpdateFinCommanderPlanDto,
  FinCommanderGoalDto,
  UpdateFinCommanderGoalDto,
  FinCommanderScenarioDto,
  UpdateFinCommanderScenarioDto,
  CreateFinCommanderPlanDto,
  CreateFinCommanderGoalDto,
  CreateFinCommanderScenarioDto,
} from '@optimistic-tanuki/constants';
import {
  AccountDto,
  BankConnectionDto,
  BankConnectionExchangeDto,
  BankConnectionLinkTokenDto,
  BankLinkTokenResponseDto,
  BankSyncResultDto,
  BootstrapFinanceWorkspaceDto,
  CreateAccountDto,
  UpdateAccountDto,
  TransactionDto,
  CreateTransactionDto,
  UpdateTransactionDto,
  InventoryItemDto,
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  BudgetDto,
  CreateBudgetDto,
  CreateFinanceTenantDto,
  CreateRecurringItemDto,
  FinanceWorkQueueDto,
  FinanceOnboardingStateDto,
  FinanceWorkspace,
  FinanceWorkspaceSummaryDto,
  FinanceTenantDto,
  FinanceTenantMemberDto,
  RecurringItemDto,
  UpdateBudgetDto,
  UpdateRecurringItemDto,
  CreateFinancialCheckoutSessionDto,
  CreateFinancialInvoiceDto,
  FinancialCheckoutSessionDto,
  FinancialInvoiceDto,
  RecordFinancialInvoicePaymentDto,
  UpdateFinancialInvoiceDto,
} from '@optimistic-tanuki/models';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { AppScope } from '../../decorators/appscope.decorator';
import { FinanceTenantId } from '../../decorators/finance-tenant-id.decorator';
import { User } from '../../decorators/user.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';
import {
  PermissionTarget,
  RequirePermissions,
} from '../../decorators/permissions.decorator';
import { Throttle } from '@nestjs/throttler';

@ApiTags('finance')
@Controller('finance')
export class FinanceController {
  private readonly logger = new Logger(FinanceController.name);

  constructor(
    @Inject(ServiceTokens.FINANCE_SERVICE)
    private readonly financeClient: ClientProxy
  ) {}

  private mapFinanceRpcError(error: unknown): never {
    if (error instanceof HttpException) {
      throw error;
    }

    const statusCode =
      typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : undefined;
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? (error as { message?: unknown }).message
        : undefined;
    const normalizedMessage = Array.isArray(message)
      ? message.join(', ')
      : typeof message === 'string'
      ? message
      : error instanceof Error
      ? error.message
      : 'Finance service request failed';

    switch (statusCode) {
      case 400:
        throw new BadRequestException(normalizedMessage);
      case 404:
        throw new NotFoundException(normalizedMessage);
      default:
        throw new InternalServerErrorException(normalizedMessage);
    }
  }

  private async sendFinanceCommand<T>(
    pattern: { cmd: string },
    payload: unknown
  ): Promise<T> {
    return await firstValueFrom(
      this.financeClient
        .send<T>(pattern, payload)
        .pipe(
          catchError((error) =>
            throwError(() => this.mapFinanceRpcError(error))
          )
        )
    );
  }

  private getScope(
    user: { userId: string; profileId: string },
    appScope?: string,
    tenantId?: string | null
  ) {
    return {
      userId: user.userId,
      profileId: user.profileId,
      ...(tenantId ? { tenantId } : {}),
      appScope: appScope || 'finance',
    };
  }

  private withWorkspaceScope(
    user: { userId: string; profileId: string },
    appScope: string | undefined,
    tenantId?: string | null,
    workspace?: FinanceWorkspace
  ) {
    return workspace
      ? { ...this.getScope(user, appScope, tenantId), where: { workspace } }
      : this.getScope(user, appScope, tenantId);
  }

  // Account endpoints
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('account')
  @ApiOperation({ summary: 'Create a new account' })
  @ApiResponse({
    status: 201,
    description: 'The account has been successfully created.',
    type: AccountDto,
  })
  @Post('account')
  @RequirePermissions('finance.account.create')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createAccount(
    @User() user,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Body() accountDto: Record<string, unknown>
  ) {
    this.logger.log(`Creating account for user: ${user.userId}`);
    const payload = {
      ...(accountDto as Partial<CreateAccountDto>),
      ...this.getScope(user, appScope, tenantId),
    } as CreateAccountDto;
    return await firstValueFrom(
      this.financeClient.send({ cmd: AccountCommands.CREATE }, payload)
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('account')
  @ApiOperation({ summary: 'Get an account by ID' })
  @ApiResponse({
    status: 200,
    description: 'The account has been successfully retrieved.',
    type: AccountDto,
  })
  @Get('account/:id')
  @RequirePermissions('finance.account.read')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async getAccount(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<AccountDto> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: AccountCommands.FIND },
        { id, ...this.getScope(user, appScope, tenantId) }
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('account')
  @ApiOperation({ summary: 'Get all accounts' })
  @ApiResponse({
    status: 200,
    description: 'The accounts have been successfully retrieved.',
    type: [AccountDto],
  })
  @Get('accounts')
  @RequirePermissions('finance.account.read')
  async getAllAccounts(
    @User() user,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Query('workspace') workspace?: FinanceWorkspace
  ): Promise<AccountDto[]> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: AccountCommands.FIND_MANY },
        this.withWorkspaceScope(user, appScope, tenantId, workspace)
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('account')
  @ApiOperation({ summary: 'Update an account by ID' })
  @ApiResponse({
    status: 200,
    description: 'The account has been successfully updated.',
    type: AccountDto,
  })
  @Put('account/:id')
  @RequirePermissions('finance.account.update')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async updateAccount(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Body() updateAccountDto: UpdateAccountDto
  ): Promise<AccountDto> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: AccountCommands.UPDATE },
        {
          id,
          data: updateAccountDto,
          ...this.getScope(user, appScope, tenantId),
        }
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('account')
  @ApiOperation({ summary: 'Delete an account by ID' })
  @ApiResponse({
    status: 200,
    description: 'The account has been successfully deleted.',
  })
  @Delete('account/:id')
  @RequirePermissions('finance.account.delete')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async deleteAccount(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<void> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: AccountCommands.DELETE },
        { id, ...this.getScope(user, appScope, tenantId) }
      ),
      { defaultValue: undefined }
    );
  }

  // Transaction endpoints
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('transaction')
  @ApiOperation({ summary: 'Create a new transaction' })
  @ApiResponse({
    status: 201,
    description: 'The transaction has been successfully created.',
    type: TransactionDto,
  })
  @Post('transaction')
  @RequirePermissions('finance.transaction.create')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async createTransaction(
    @User() user,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Body() transactionDto: Record<string, unknown>
  ) {
    this.logger.log(`Creating transaction for user: ${user.userId}`);
    const payload = {
      ...(transactionDto as Partial<CreateTransactionDto>),
      ...this.getScope(user, appScope, tenantId),
    } as CreateTransactionDto;
    return await firstValueFrom(
      this.financeClient.send({ cmd: TransactionCommands.CREATE }, payload)
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('transaction')
  @ApiOperation({ summary: 'Get a transaction by ID' })
  @ApiResponse({
    status: 200,
    description: 'The transaction has been successfully retrieved.',
    type: TransactionDto,
  })
  @Get('transaction/:id')
  @RequirePermissions('finance.transaction.read')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async getTransaction(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<TransactionDto> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: TransactionCommands.FIND },
        { id, ...this.getScope(user, appScope, tenantId) }
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('transaction')
  @ApiOperation({ summary: 'Get transactions for an account' })
  @ApiResponse({
    status: 200,
    description: 'The transactions have been successfully retrieved.',
    type: [TransactionDto],
  })
  @Get('account/:accountId/transactions')
  @RequirePermissions('finance.transaction.read')
  async getTransactionsByAccount(
    @User() user,
    @Param('accountId') accountId: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Query('workspace') workspace?: FinanceWorkspace
  ): Promise<TransactionDto[]> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: TransactionCommands.FIND_MANY },
        {
          ...this.getScope(user, appScope, tenantId),
          where: workspace ? { accountId, workspace } : { accountId },
        }
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('transaction')
  @ApiOperation({ summary: 'Get all transactions' })
  @ApiResponse({
    status: 200,
    description: 'The transactions have been successfully retrieved.',
    type: [TransactionDto],
  })
  @Get('transactions')
  @RequirePermissions('finance.transaction.read')
  async getAllTransactions(
    @User() user,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Query('workspace') workspace?: FinanceWorkspace
  ): Promise<TransactionDto[]> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: TransactionCommands.FIND_MANY },
        this.withWorkspaceScope(user, appScope, tenantId, workspace)
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('transaction')
  @ApiOperation({ summary: 'Update a transaction by ID' })
  @ApiResponse({
    status: 200,
    description: 'The transaction has been successfully updated.',
    type: TransactionDto,
  })
  @Put('transaction/:id')
  @RequirePermissions('finance.transaction.update')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async updateTransaction(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Body() updateTransactionDto: UpdateTransactionDto
  ): Promise<TransactionDto> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: TransactionCommands.UPDATE },
        {
          id,
          data: updateTransactionDto,
          ...this.getScope(user, appScope, tenantId),
        }
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('transaction')
  @ApiOperation({ summary: 'Delete a transaction by ID' })
  @ApiResponse({
    status: 200,
    description: 'The transaction has been successfully deleted.',
  })
  @Delete('transaction/:id')
  @RequirePermissions('finance.transaction.delete')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async deleteTransaction(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<void> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: TransactionCommands.DELETE },
        { id, ...this.getScope(user, appScope, tenantId) }
      ),
      { defaultValue: undefined }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Create a bank provider link token' })
  @ApiResponse({
    status: 201,
    description: 'The provider link token has been successfully created.',
    type: BankLinkTokenResponseDto,
  })
  @Post('bank/link-token')
  @RequirePermissions('finance.bank.manage')
  async createBankLinkToken(
    @User() user,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Body() payload: BankConnectionLinkTokenDto
  ): Promise<BankLinkTokenResponseDto> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: FinanceBankingCommands.CREATE_LINK_TOKEN },
        {
          ...payload,
          ...this.getScope(user, appScope, tenantId),
        }
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({
    summary: 'Exchange a provider public token into a bank connection',
  })
  @ApiResponse({
    status: 201,
    description: 'The bank connection has been successfully created.',
    type: BankConnectionDto,
  })
  @Post('bank/connect')
  @RequirePermissions('finance.bank.manage')
  async connectBankProvider(
    @User() user,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Body() payload: BankConnectionExchangeDto
  ): Promise<BankConnectionDto> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: FinanceBankingCommands.EXCHANGE_PUBLIC_TOKEN },
        {
          ...payload,
          ...this.getScope(user, appScope, tenantId),
        }
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'List bank connections' })
  @ApiResponse({
    status: 200,
    description: 'The bank connections have been successfully retrieved.',
    type: [BankConnectionDto],
  })
  @Get('bank/connections')
  @RequirePermissions('finance.bank.manage')
  async listBankConnections(
    @User() user,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<BankConnectionDto[]> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: FinanceBankingCommands.LIST_CONNECTIONS },
        this.getScope(user, appScope, tenantId)
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Sync a bank connection' })
  @ApiResponse({
    status: 200,
    description: 'The bank connection has been synced.',
    type: BankSyncResultDto,
  })
  @Post('bank/connection/:id/sync')
  @RequirePermissions('finance.bank.manage')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async syncBankConnection(
    @User() user,
    @Param('id') connectionId: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<BankSyncResultDto> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: FinanceBankingCommands.SYNC_CONNECTION },
        {
          connectionId,
          ...this.getScope(user, appScope, tenantId),
        }
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Disconnect a bank connection' })
  @ApiResponse({
    status: 200,
    description: 'The bank connection has been disconnected.',
    type: BankConnectionDto,
  })
  @Delete('bank/connection/:id')
  @RequirePermissions('finance.bank.manage')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async disconnectBankConnection(
    @User() user,
    @Param('id') connectionId: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<BankConnectionDto> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: FinanceBankingCommands.DISCONNECT_CONNECTION },
        {
          connectionId,
          ...this.getScope(user, appScope, tenantId),
        }
      )
    );
  }

  @ApiOperation({ summary: 'Receive a bank provider webhook' })
  @ApiResponse({
    status: 202,
    description: 'The webhook has been accepted.',
  })
  @Post('bank/webhook/plaid')
  async receivePlaidWebhook(@Body() payload: Record<string, unknown>) {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: FinanceBankingCommands.PROCESS_WEBHOOK },
        payload
      )
    );
  }

  // Inventory Item endpoints
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('inventory-item')
  @ApiOperation({ summary: 'Create a new inventory item' })
  @ApiResponse({
    status: 201,
    description: 'The inventory item has been successfully created.',
    type: InventoryItemDto,
  })
  @Post('inventory-item')
  @RequirePermissions('finance.inventory.create')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createInventoryItem(
    @User() user,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Body() inventoryItemDto: Record<string, unknown>
  ) {
    this.logger.log(`Creating inventory item for user: ${user.userId}`);
    const payload = {
      ...(inventoryItemDto as Partial<CreateInventoryItemDto>),
      ...this.getScope(user, appScope, tenantId),
    } as CreateInventoryItemDto;
    return await firstValueFrom(
      this.financeClient.send({ cmd: InventoryItemCommands.CREATE }, payload)
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('inventory-item')
  @ApiOperation({ summary: 'Get an inventory item by ID' })
  @ApiResponse({
    status: 200,
    description: 'The inventory item has been successfully retrieved.',
    type: InventoryItemDto,
  })
  @Get('inventory-item/:id')
  @RequirePermissions('finance.inventory.read')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async getInventoryItem(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<InventoryItemDto> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: InventoryItemCommands.FIND },
        { id, ...this.getScope(user, appScope, tenantId) }
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('inventory-item')
  @ApiOperation({ summary: 'Get all inventory items' })
  @ApiResponse({
    status: 200,
    description: 'The inventory items have been successfully retrieved.',
    type: [InventoryItemDto],
  })
  @Get('inventory-items')
  @RequirePermissions('finance.inventory.read')
  async getAllInventoryItems(
    @User() user,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Query('workspace') workspace?: FinanceWorkspace
  ): Promise<InventoryItemDto[]> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: InventoryItemCommands.FIND_MANY },
        this.withWorkspaceScope(user, appScope, tenantId, workspace)
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('inventory-item')
  @ApiOperation({ summary: 'Update an inventory item by ID' })
  @ApiResponse({
    status: 200,
    description: 'The inventory item has been successfully updated.',
    type: InventoryItemDto,
  })
  @Put('inventory-item/:id')
  @RequirePermissions('finance.inventory.update')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async updateInventoryItem(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Body() updateInventoryItemDto: UpdateInventoryItemDto
  ): Promise<InventoryItemDto> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: InventoryItemCommands.UPDATE },
        {
          id,
          data: updateInventoryItemDto,
          ...this.getScope(user, appScope, tenantId),
        }
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('inventory-item')
  @ApiOperation({ summary: 'Delete an inventory item by ID' })
  @ApiResponse({
    status: 200,
    description: 'The inventory item has been successfully deleted.',
  })
  @Delete('inventory-item/:id')
  @RequirePermissions('finance.inventory.delete')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async deleteInventoryItem(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<void> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: InventoryItemCommands.DELETE },
        { id, ...this.getScope(user, appScope, tenantId) }
      ),
      { defaultValue: undefined }
    );
  }

  // Budget endpoints
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('budget')
  @ApiOperation({ summary: 'Create a new budget' })
  @ApiResponse({
    status: 201,
    description: 'The budget has been successfully created.',
    type: BudgetDto,
  })
  @Post('budget')
  @RequirePermissions('finance.budget.create')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createBudget(
    @User() user,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Body() budgetDto: Record<string, unknown>
  ) {
    this.logger.log(`Creating budget for user: ${user.userId}`);
    const payload = {
      ...(budgetDto as Partial<CreateBudgetDto>),
      ...this.getScope(user, appScope, tenantId),
    } as CreateBudgetDto;
    return await firstValueFrom(
      this.financeClient.send({ cmd: BudgetCommands.CREATE }, payload)
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('budget')
  @ApiOperation({ summary: 'Get a budget by ID' })
  @ApiResponse({
    status: 200,
    description: 'The budget has been successfully retrieved.',
    type: BudgetDto,
  })
  @Get('budget/:id')
  @RequirePermissions('finance.budget.read')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async getBudget(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<BudgetDto> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: BudgetCommands.FIND },
        { id, ...this.getScope(user, appScope, tenantId) }
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('budget')
  @ApiOperation({ summary: 'Get all budgets' })
  @ApiResponse({
    status: 200,
    description: 'The budgets have been successfully retrieved.',
    type: [BudgetDto],
  })
  @Get('budgets')
  @RequirePermissions('finance.budget.read')
  async getAllBudgets(
    @User() user,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Query('workspace') workspace?: FinanceWorkspace
  ): Promise<BudgetDto[]> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: BudgetCommands.FIND_MANY },
        this.withWorkspaceScope(user, appScope, tenantId, workspace)
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Get workspace summary' })
  @ApiResponse({
    status: 200,
    description: 'The workspace summary has been successfully retrieved.',
    type: FinanceWorkspaceSummaryDto,
  })
  @Get('summary/:workspace')
  @RequirePermissions('finance.summary.read')
  async getSummary(
    @User() user,
    @Param('workspace') workspace: FinanceWorkspace,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<FinanceWorkspaceSummaryDto> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: FinanceSummaryCommands.GET_WORKSPACE_SUMMARY },
        { workspace, ...this.getScope(user, appScope, tenantId) }
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Get workspace work queue' })
  @ApiResponse({
    status: 200,
    description: 'The workspace work queue has been successfully retrieved.',
    type: FinanceWorkQueueDto,
  })
  @Get('work-queue/:workspace')
  @RequirePermissions('finance.summary.read')
  async getWorkQueue(
    @User() user,
    @Param('workspace') workspace: FinanceWorkspace,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<FinanceWorkQueueDto> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: FinanceSummaryCommands.GET_WORK_QUEUE },
        { workspace, ...this.getScope(user, appScope, tenantId) }
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Get finance onboarding state' })
  @ApiResponse({
    status: 200,
    description: 'The onboarding state has been successfully retrieved.',
    type: FinanceOnboardingStateDto,
  })
  @Get('onboarding/state')
  @RequirePermissions('finance.onboarding.manage')
  async getOnboardingState(
    @User() user,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<FinanceOnboardingStateDto> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: FinanceSummaryCommands.GET_ONBOARDING_STATE },
        this.getScope(user, appScope, tenantId)
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Bootstrap finance workspaces' })
  @ApiResponse({
    status: 200,
    description: 'Starter workspace data has been created.',
    type: FinanceOnboardingStateDto,
  })
  @Post('onboarding/bootstrap')
  @RequirePermissions('finance.onboarding.manage')
  async bootstrapWorkspaces(
    @User() user,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Body() data: BootstrapFinanceWorkspaceDto
  ): Promise<FinanceOnboardingStateDto> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: FinanceSummaryCommands.BOOTSTRAP },
        { data, ...this.getScope(user, appScope, tenantId) }
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('budget')
  @ApiOperation({ summary: 'Update a budget by ID' })
  @ApiResponse({
    status: 200,
    description: 'The budget has been successfully updated.',
    type: BudgetDto,
  })
  @Put('budget/:id')
  @RequirePermissions('finance.budget.update')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async updateBudget(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Body() updateBudgetDto: UpdateBudgetDto
  ): Promise<BudgetDto> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: BudgetCommands.UPDATE },
        {
          id,
          data: updateBudgetDto,
          ...this.getScope(user, appScope, tenantId),
        }
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('budget')
  @ApiOperation({ summary: 'Delete a budget by ID' })
  @ApiResponse({
    status: 200,
    description: 'The budget has been successfully deleted.',
  })
  @Delete('budget/:id')
  @RequirePermissions('finance.budget.delete')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async deleteBudget(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<void> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: BudgetCommands.DELETE },
        { id, ...this.getScope(user, appScope, tenantId) }
      ),
      { defaultValue: undefined }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Create a recurring item' })
  @ApiResponse({
    status: 201,
    description: 'The recurring item has been successfully created.',
    type: RecurringItemDto,
  })
  @Post('recurring-item')
  @RequirePermissions('finance.recurring.create')
  async createRecurringItem(
    @User() user,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Body() recurringItemDto: Record<string, unknown>
  ): Promise<RecurringItemDto> {
    const payload = {
      ...(recurringItemDto as Partial<CreateRecurringItemDto>),
      ...this.getScope(user, appScope, tenantId),
    } as CreateRecurringItemDto;
    return await firstValueFrom(
      this.financeClient.send({ cmd: RecurringItemCommands.CREATE }, payload)
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Get all recurring items' })
  @ApiResponse({
    status: 200,
    description: 'The recurring items have been successfully retrieved.',
    type: [RecurringItemDto],
  })
  @Get('recurring-items')
  @RequirePermissions('finance.recurring.read')
  async getAllRecurringItems(
    @User() user,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Query('workspace') workspace?: FinanceWorkspace
  ): Promise<RecurringItemDto[]> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: RecurringItemCommands.FIND_MANY },
        this.withWorkspaceScope(user, appScope, tenantId, workspace)
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Get a recurring item by ID' })
  @ApiResponse({
    status: 200,
    description: 'The recurring item has been successfully retrieved.',
    type: RecurringItemDto,
  })
  @Get('recurring-item/:id')
  @RequirePermissions('finance.recurring.read')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async getRecurringItem(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<RecurringItemDto> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: RecurringItemCommands.FIND },
        { id, ...this.getScope(user, appScope, tenantId) }
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Update a recurring item by ID' })
  @ApiResponse({
    status: 200,
    description: 'The recurring item has been successfully updated.',
    type: RecurringItemDto,
  })
  @Put('recurring-item/:id')
  @RequirePermissions('finance.recurring.update')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async updateRecurringItem(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Body() updateRecurringItemDto: UpdateRecurringItemDto
  ): Promise<RecurringItemDto> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: RecurringItemCommands.UPDATE },
        {
          id,
          data: updateRecurringItemDto,
          ...this.getScope(user, appScope, tenantId),
        }
      )
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Delete a recurring item by ID' })
  @ApiResponse({
    status: 200,
    description: 'The recurring item has been successfully deleted.',
  })
  @Delete('recurring-item/:id')
  @RequirePermissions('finance.recurring.delete')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async deleteRecurringItem(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<void> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: RecurringItemCommands.DELETE },
        { id, ...this.getScope(user, appScope, tenantId) }
      ),
      { defaultValue: undefined }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('financial invoice')
  @ApiOperation({ summary: 'Create a business invoice' })
  @Post('invoices')
  @RequirePermissions('finance.invoice.create')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createInvoice(
    @User() user,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Body() invoiceDto: CreateFinancialInvoiceDto
  ): Promise<FinancialInvoiceDto> {
    return await this.sendFinanceCommand(
      { cmd: FinancialUtilitiesCommands.CREATE_INVOICE },
      {
        ...invoiceDto,
        ...this.getScope(user, appScope, tenantId),
      }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('financial invoice')
  @ApiOperation({ summary: 'List business invoices' })
  @Get('invoices')
  @RequirePermissions('finance.invoice.read')
  async listInvoices(
    @User() user,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Query('workspace') workspace?: FinanceWorkspace
  ): Promise<FinancialInvoiceDto[]> {
    return await this.sendFinanceCommand(
      { cmd: FinancialUtilitiesCommands.LIST_INVOICES },
      this.withWorkspaceScope(user, appScope, tenantId, workspace)
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('financial invoice')
  @ApiOperation({ summary: 'Get a business invoice' })
  @Get('invoice/:id')
  @RequirePermissions('finance.invoice.read')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async getInvoice(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<FinancialInvoiceDto> {
    return await this.sendFinanceCommand(
      { cmd: FinancialUtilitiesCommands.GET_INVOICE },
      { id, ...this.getScope(user, appScope, tenantId) }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('financial invoice')
  @ApiOperation({ summary: 'Update a business invoice' })
  @Put('invoice/:id')
  @RequirePermissions('finance.invoice.update')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async updateInvoice(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Body() invoiceDto: UpdateFinancialInvoiceDto
  ): Promise<FinancialInvoiceDto> {
    return await this.sendFinanceCommand(
      { cmd: FinancialUtilitiesCommands.UPDATE_INVOICE },
      {
        id,
        data: invoiceDto,
        ...this.getScope(user, appScope, tenantId),
      }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('financial invoice')
  @ApiOperation({ summary: 'Send a business invoice' })
  @Post('invoice/:id/send')
  @RequirePermissions('finance.invoice.update')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async sendInvoice(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<FinancialInvoiceDto> {
    return await this.sendFinanceCommand(
      { cmd: FinancialUtilitiesCommands.SEND_INVOICE },
      { id, ...this.getScope(user, appScope, tenantId) }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('financial invoice')
  @ApiOperation({ summary: 'Void a business invoice' })
  @Post('invoice/:id/void')
  @RequirePermissions('finance.invoice.update')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async voidInvoice(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<FinancialInvoiceDto> {
    return await this.sendFinanceCommand(
      { cmd: FinancialUtilitiesCommands.VOID_INVOICE },
      { id, ...this.getScope(user, appScope, tenantId) }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('financial invoice')
  @ApiOperation({ summary: 'Record an invoice payment' })
  @Post('invoice/:id/pay')
  @RequirePermissions('finance.invoice.pay')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async recordInvoicePayment(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Body() paymentDto: RecordFinancialInvoicePaymentDto
  ): Promise<FinancialInvoiceDto> {
    return await this.sendFinanceCommand(
      { cmd: FinancialUtilitiesCommands.RECORD_INVOICE_PAYMENT },
      {
        id,
        data: paymentDto,
        ...this.getScope(user, appScope, tenantId),
      }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('financial checkout')
  @ApiOperation({ summary: 'Create a checkout or deposit session' })
  @Post('checkout-sessions')
  @RequirePermissions('finance.checkout.create')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createCheckoutSession(
    @User() user,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Body() checkoutDto: CreateFinancialCheckoutSessionDto
  ): Promise<FinancialCheckoutSessionDto> {
    return await this.sendFinanceCommand(
      { cmd: FinancialUtilitiesCommands.CREATE_CHECKOUT_SESSION },
      {
        ...checkoutDto,
        ...this.getScope(user, appScope, tenantId),
      }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('financial checkout')
  @ApiOperation({ summary: 'List checkout and deposit sessions' })
  @Get('checkout-sessions')
  @RequirePermissions('finance.checkout.read')
  async listCheckoutSessions(
    @User() user,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Query('workspace') workspace?: FinanceWorkspace
  ): Promise<FinancialCheckoutSessionDto[]> {
    return await this.sendFinanceCommand(
      { cmd: FinancialUtilitiesCommands.LIST_CHECKOUT_SESSIONS },
      this.withWorkspaceScope(user, appScope, tenantId, workspace)
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('financial checkout')
  @ApiOperation({ summary: 'Get a checkout or deposit session' })
  @Get('checkout-session/:id')
  @RequirePermissions('finance.checkout.read')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async getCheckoutSession(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<FinancialCheckoutSessionDto> {
    return await this.sendFinanceCommand(
      { cmd: FinancialUtilitiesCommands.GET_CHECKOUT_SESSION },
      { id, ...this.getScope(user, appScope, tenantId) }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Create a finance tenant for the active profile' })
  @ApiResponse({
    status: 201,
    description: 'The finance tenant has been successfully created.',
    type: Object,
  })
  @Post('tenant')
  @RequirePermissions('finance.tenant.manage')
  async createTenant(
    @User() user,
    @AppScope() appScope: string,
    @Body() tenantDto: CreateFinanceTenantDto
  ): Promise<FinanceTenantDto> {
    return await this.sendFinanceCommand(
      { cmd: FinanceTenantCommands.CREATE_TENANT },
      {
        ...tenantDto,
        ...this.getScope(user, appScope),
      }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'List finance tenants for the current profile' })
  @ApiResponse({
    status: 200,
    description: 'The finance tenants have been successfully retrieved.',
    type: [Object],
  })
  @Get('tenant')
  @RequirePermissions('finance.tenant.manage')
  async listTenants(
    @User() user,
    @AppScope() appScope: string
  ): Promise<FinanceTenantDto[]> {
    return await this.sendFinanceCommand(
      { cmd: FinanceTenantCommands.LIST_TENANTS },
      this.getScope(user, appScope)
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Get the active finance tenant' })
  @ApiResponse({
    status: 200,
    description: 'The active finance tenant has been successfully retrieved.',
    type: Object,
  })
  @Get('tenant/current')
  @RequirePermissions('finance.tenant.manage')
  async getCurrentTenant(
    @User() user,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<FinanceTenantDto> {
    return await this.sendFinanceCommand(
      { cmd: FinanceTenantCommands.GET_CURRENT_TENANT },
      this.getScope(user, appScope, tenantId)
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiOperation({ summary: 'List active finance tenant members' })
  @ApiResponse({
    status: 200,
    description:
      'The active finance tenant members have been successfully retrieved.',
    type: [Object],
  })
  @Get('tenant/members')
  @RequirePermissions('finance.member.manage')
  async listTenantMembers(
    @User() user,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<FinanceTenantMemberDto[]> {
    return await this.sendFinanceCommand(
      { cmd: FinanceTenantCommands.LIST_TENANT_MEMBERS },
      this.getScope(user, appScope, tenantId)
    );
  }

  // Fin Commander plan endpoints
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('fin-commander')
  @ApiOperation({ summary: 'Create a Fin Commander plan' })
  @ApiResponse({
    status: 201,
    description: 'The plan has been successfully created.',
    type: FinCommanderPlanDto,
  })
  @Post('fin-commander/plan')
  @RequirePermissions('finance.fin-commander-plan.create')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createFinCommanderPlan(
    @User() user,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Body() planDto: Record<string, unknown>
  ) {
    const payload = {
      ...(planDto as Partial<CreateFinCommanderPlanDto>),
      ...this.getScope(user, appScope, tenantId),
    } as CreateFinCommanderPlanDto;
    return await this.sendFinanceCommand(
      { cmd: FinCommanderPlanCommands.CREATE },
      payload
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('fin-commander')
  @ApiOperation({ summary: 'List Fin Commander plans' })
  @ApiResponse({
    status: 200,
    description: 'The plans have been successfully retrieved.',
    type: [FinCommanderPlanDto],
  })
  @Get('fin-commander/plans')
  @RequirePermissions('finance.fin-commander-plan.read')
  async listFinCommanderPlans(
    @User() user,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<FinCommanderPlanDto[]> {
    return await this.sendFinanceCommand(
      { cmd: FinCommanderPlanCommands.FIND_MANY },
      this.getScope(user, appScope, tenantId)
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('fin-commander')
  @ApiOperation({ summary: 'Get a Fin Commander plan by ID' })
  @ApiResponse({
    status: 200,
    description: 'The plan has been successfully retrieved.',
    type: FinCommanderPlanDto,
  })
  @Get('fin-commander/plan/:id')
  @RequirePermissions('finance.fin-commander-plan.read')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async getFinCommanderPlan(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<FinCommanderPlanDto> {
    return await this.sendFinanceCommand(
      { cmd: FinCommanderPlanCommands.FIND },
      { id, ...this.getScope(user, appScope, tenantId) }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('fin-commander')
  @ApiOperation({ summary: 'Update a Fin Commander plan by ID' })
  @ApiResponse({
    status: 200,
    description: 'The plan has been successfully updated.',
    type: FinCommanderPlanDto,
  })
  @Put('fin-commander/plan/:id')
  @RequirePermissions('finance.fin-commander-plan.update')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async updateFinCommanderPlan(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Body() updatePlanDto: UpdateFinCommanderPlanDto
  ): Promise<FinCommanderPlanDto> {
    return await this.sendFinanceCommand(
      { cmd: FinCommanderPlanCommands.UPDATE },
      {
        id,
        data: updatePlanDto,
        ...this.getScope(user, appScope, tenantId),
      }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('fin-commander')
  @ApiOperation({ summary: 'Delete a Fin Commander plan by ID' })
  @ApiResponse({
    status: 200,
    description: 'The plan has been successfully deleted.',
  })
  @Delete('fin-commander/plan/:id')
  @RequirePermissions('finance.fin-commander-plan.delete')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async deleteFinCommanderPlan(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<void> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: FinCommanderPlanCommands.DELETE },
        { id, ...this.getScope(user, appScope, tenantId) }
      ),
      { defaultValue: undefined }
    );
  }

  // Fin Commander goal endpoints
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('fin-commander')
  @ApiOperation({ summary: 'Create a Fin Commander goal' })
  @ApiResponse({
    status: 201,
    description: 'The goal has been successfully created.',
    type: FinCommanderGoalDto,
  })
  @Post('fin-commander/plan/:planId/goal')
  @RequirePermissions('finance.fin-commander-goal.create')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async createFinCommanderGoal(
    @User() user,
    @Param('planId') planId: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Body() goalDto: Record<string, unknown>
  ) {
    const payload = {
      ...(goalDto as Partial<CreateFinCommanderGoalDto>),
      planId,
      ...this.getScope(user, appScope, tenantId),
    } as CreateFinCommanderGoalDto;
    return await this.sendFinanceCommand(
      { cmd: FinCommanderGoalCommands.CREATE },
      payload
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('fin-commander')
  @ApiOperation({ summary: 'List Fin Commander goals for a plan' })
  @ApiResponse({
    status: 200,
    description: 'The goals have been successfully retrieved.',
    type: [FinCommanderGoalDto],
  })
  @Get('fin-commander/plan/:planId/goals')
  @RequirePermissions('finance.fin-commander-goal.read')
  async listFinCommanderGoals(
    @User() user,
    @Param('planId') planId: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<FinCommanderGoalDto[]> {
    return await this.sendFinanceCommand(
      { cmd: FinCommanderGoalCommands.FIND_MANY },
      { ...this.getScope(user, appScope, tenantId), where: { planId } }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('fin-commander')
  @ApiOperation({ summary: 'Get a Fin Commander goal by ID' })
  @ApiResponse({
    status: 200,
    description: 'The goal has been successfully retrieved.',
    type: FinCommanderGoalDto,
  })
  @Get('fin-commander/goal/:id')
  @RequirePermissions('finance.fin-commander-goal.read')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async getFinCommanderGoal(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<FinCommanderGoalDto> {
    return await this.sendFinanceCommand(
      { cmd: FinCommanderGoalCommands.FIND },
      { id, ...this.getScope(user, appScope, tenantId) }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('fin-commander')
  @ApiOperation({ summary: 'Update a Fin Commander goal by ID' })
  @ApiResponse({
    status: 200,
    description: 'The goal has been successfully updated.',
    type: FinCommanderGoalDto,
  })
  @Put('fin-commander/goal/:id')
  @RequirePermissions('finance.fin-commander-goal.update')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async updateFinCommanderGoal(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Body() updateGoalDto: UpdateFinCommanderGoalDto
  ): Promise<FinCommanderGoalDto> {
    return await this.sendFinanceCommand(
      { cmd: FinCommanderGoalCommands.UPDATE },
      {
        id,
        data: updateGoalDto,
        ...this.getScope(user, appScope, tenantId),
      }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('fin-commander')
  @ApiOperation({ summary: 'Delete a Fin Commander goal by ID' })
  @ApiResponse({
    status: 200,
    description: 'The goal has been successfully deleted.',
  })
  @Delete('fin-commander/goal/:id')
  @RequirePermissions('finance.fin-commander-goal.delete')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async deleteFinCommanderGoal(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<void> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: FinCommanderGoalCommands.DELETE },
        { id, ...this.getScope(user, appScope, tenantId) }
      ),
      { defaultValue: undefined }
    );
  }

  // Fin Commander scenario endpoints
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('fin-commander')
  @ApiOperation({ summary: 'Create a Fin Commander scenario' })
  @ApiResponse({
    status: 201,
    description: 'The scenario has been successfully created.',
    type: FinCommanderScenarioDto,
  })
  @Post('fin-commander/plan/:planId/scenario')
  @RequirePermissions('finance.fin-commander-scenario.create')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async createFinCommanderScenario(
    @User() user,
    @Param('planId') planId: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Body() scenarioDto: Record<string, unknown>
  ) {
    const payload = {
      ...(scenarioDto as Partial<CreateFinCommanderScenarioDto>),
      planId,
      ...this.getScope(user, appScope, tenantId),
    } as CreateFinCommanderScenarioDto;
    return await this.sendFinanceCommand(
      { cmd: FinCommanderScenarioCommands.CREATE },
      payload
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('fin-commander')
  @ApiOperation({ summary: 'List Fin Commander scenarios for a plan' })
  @ApiResponse({
    status: 200,
    description: 'The scenarios have been successfully retrieved.',
    type: [FinCommanderScenarioDto],
  })
  @Get('fin-commander/plan/:planId/scenarios')
  @RequirePermissions('finance.fin-commander-scenario.read')
  async listFinCommanderScenarios(
    @User() user,
    @Param('planId') planId: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<FinCommanderScenarioDto[]> {
    return await this.sendFinanceCommand(
      { cmd: FinCommanderScenarioCommands.FIND_MANY },
      { ...this.getScope(user, appScope, tenantId), where: { planId } }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('fin-commander')
  @ApiOperation({ summary: 'Get a Fin Commander scenario by ID' })
  @ApiResponse({
    status: 200,
    description: 'The scenario has been successfully retrieved.',
    type: FinCommanderScenarioDto,
  })
  @Get('fin-commander/scenario/:id')
  @RequirePermissions('finance.fin-commander-scenario.read')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async getFinCommanderScenario(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<FinCommanderScenarioDto> {
    return await this.sendFinanceCommand(
      { cmd: FinCommanderScenarioCommands.FIND },
      { id, ...this.getScope(user, appScope, tenantId) }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('fin-commander')
  @ApiOperation({ summary: 'Update a Fin Commander scenario by ID' })
  @ApiResponse({
    status: 200,
    description: 'The scenario has been successfully updated.',
    type: FinCommanderScenarioDto,
  })
  @Put('fin-commander/scenario/:id')
  @RequirePermissions('finance.fin-commander-scenario.update')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async updateFinCommanderScenario(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null,
    @Body() updateScenarioDto: UpdateFinCommanderScenarioDto
  ): Promise<FinCommanderScenarioDto> {
    return await this.sendFinanceCommand(
      { cmd: FinCommanderScenarioCommands.UPDATE },
      {
        id,
        data: updateScenarioDto,
        ...this.getScope(user, appScope, tenantId),
      }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('fin-commander')
  @ApiOperation({ summary: 'Delete a Fin Commander scenario by ID' })
  @ApiResponse({
    status: 200,
    description: 'The scenario has been successfully deleted.',
  })
  @Delete('fin-commander/scenario/:id')
  @RequirePermissions('finance.fin-commander-scenario.delete')
  @PermissionTarget('headers', 'x-finance-tenant-id')
  async deleteFinCommanderScenario(
    @User() user,
    @Param('id') id: string,
    @AppScope() appScope: string,
    @FinanceTenantId() tenantId: string | null
  ): Promise<void> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: FinCommanderScenarioCommands.DELETE },
        { id, ...this.getScope(user, appScope, tenantId) }
      ),
      { defaultValue: undefined }
    );
  }
}
