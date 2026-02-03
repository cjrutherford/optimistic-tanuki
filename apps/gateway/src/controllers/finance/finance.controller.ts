import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Logger,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ServiceTokens,
  AccountCommands,
  TransactionCommands,
  InventoryItemCommands,
  BudgetCommands,
} from '@optimistic-tanuki/constants';
import {
  AccountDto,
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
  UpdateBudgetDto,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { User } from '../../decorators/user.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { Throttle } from '@nestjs/throttler';

@ApiTags('finance')
@Controller('finance')
export class FinanceController {
  private readonly logger = new Logger(FinanceController.name);

  constructor(
    @Inject(ServiceTokens.FINANCE_SERVICE)
    private readonly financeClient: ClientProxy
  ) { }

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
  async createAccount(@User() user, @Body() accountDto: CreateAccountDto) {
    this.logger.log(`Creating account for user: ${user.userId}`);
    accountDto.userId = user.userId;
    return await firstValueFrom(
      this.financeClient.send({ cmd: AccountCommands.CREATE }, accountDto)
    );
  }

  @ApiTags('account')
  @ApiOperation({ summary: 'Get an account by ID' })
  @ApiResponse({
    status: 200,
    description: 'The account has been successfully retrieved.',
    type: AccountDto,
  })
  @Get('account/:id')
  async getAccount(@Param('id') id: string): Promise<AccountDto> {
    return await firstValueFrom(
      this.financeClient.send({ cmd: AccountCommands.FIND }, { id })
    );
  }

  @ApiTags('account')
  @ApiOperation({ summary: 'Get all accounts' })
  @ApiResponse({
    status: 200,
    description: 'The accounts have been successfully retrieved.',
    type: [AccountDto],
  })
  @Get('accounts')
  async getAllAccounts(): Promise<AccountDto[]> {
    return await firstValueFrom(
      this.financeClient.send({ cmd: AccountCommands.FIND_MANY }, {})
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
  async updateAccount(
    @Param('id') id: string,
    @Body() updateAccountDto: UpdateAccountDto
  ): Promise<AccountDto> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: AccountCommands.UPDATE },
        { id, data: updateAccountDto }
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
  async deleteAccount(@Param('id') id: string): Promise<void> {
    return await firstValueFrom(
      this.financeClient.send({ cmd: AccountCommands.DELETE }, { id })
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
  async createTransaction(@User() user, @Body() transactionDto: CreateTransactionDto) {
    this.logger.log(`Creating transaction for user: ${user.userId}`);
    transactionDto.userId = user.userId;
    return await firstValueFrom(
      this.financeClient.send({ cmd: TransactionCommands.CREATE }, transactionDto)
    );
  }

  @ApiTags('transaction')
  @ApiOperation({ summary: 'Get a transaction by ID' })
  @ApiResponse({
    status: 200,
    description: 'The transaction has been successfully retrieved.',
    type: TransactionDto,
  })
  @Get('transaction/:id')
  async getTransaction(@Param('id') id: string): Promise<TransactionDto> {
    return await firstValueFrom(
      this.financeClient.send({ cmd: TransactionCommands.FIND }, { id })
    );
  }

  @ApiTags('transaction')
  @ApiOperation({ summary: 'Get transactions for an account' })
  @ApiResponse({
    status: 200,
    description: 'The transactions have been successfully retrieved.',
    type: [TransactionDto],
  })
  @Get('account/:accountId/transactions')
  async getTransactionsByAccount(
    @Param('accountId') accountId: string
  ): Promise<TransactionDto[]> {
    return await firstValueFrom(
      this.financeClient.send({ cmd: TransactionCommands.FIND_MANY }, { where: { accountId } })
    );
  }

  @ApiTags('transaction')
  @ApiOperation({ summary: 'Get all transactions' })
  @ApiResponse({
    status: 200,
    description: 'The transactions have been successfully retrieved.',
    type: [TransactionDto],
  })
  @Get('transactions')
  async getAllTransactions(): Promise<TransactionDto[]> {
    return await firstValueFrom(
      this.financeClient.send({ cmd: TransactionCommands.FIND_MANY }, {})
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
  async updateTransaction(
    @Param('id') id: string,
    @Body() updateTransactionDto: UpdateTransactionDto
  ): Promise<TransactionDto> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: TransactionCommands.UPDATE },
        { id, data: updateTransactionDto }
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
  async deleteTransaction(@Param('id') id: string): Promise<void> {
    return await firstValueFrom(
      this.financeClient.send({ cmd: TransactionCommands.DELETE }, { id })
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
  async createInventoryItem(@User() user, @Body() inventoryItemDto: CreateInventoryItemDto) {
    this.logger.log(`Creating inventory item for user: ${user.userId}`);
    inventoryItemDto.userId = user.userId;
    return await firstValueFrom(
      this.financeClient.send({ cmd: InventoryItemCommands.CREATE }, inventoryItemDto)
    );
  }

  @ApiTags('inventory-item')
  @ApiOperation({ summary: 'Get an inventory item by ID' })
  @ApiResponse({
    status: 200,
    description: 'The inventory item has been successfully retrieved.',
    type: InventoryItemDto,
  })
  @Get('inventory-item/:id')
  async getInventoryItem(@Param('id') id: string): Promise<InventoryItemDto> {
    return await firstValueFrom(
      this.financeClient.send({ cmd: InventoryItemCommands.FIND }, { id })
    );
  }

  @ApiTags('inventory-item')
  @ApiOperation({ summary: 'Get all inventory items' })
  @ApiResponse({
    status: 200,
    description: 'The inventory items have been successfully retrieved.',
    type: [InventoryItemDto],
  })
  @Get('inventory-items')
  async getAllInventoryItems(): Promise<InventoryItemDto[]> {
    return await firstValueFrom(
      this.financeClient.send({ cmd: InventoryItemCommands.FIND_MANY }, {})
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
  async updateInventoryItem(
    @Param('id') id: string,
    @Body() updateInventoryItemDto: UpdateInventoryItemDto
  ): Promise<InventoryItemDto> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: InventoryItemCommands.UPDATE },
        { id, data: updateInventoryItemDto }
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
  async deleteInventoryItem(@Param('id') id: string): Promise<void> {
    return await firstValueFrom(
      this.financeClient.send({ cmd: InventoryItemCommands.DELETE }, { id })
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
  async createBudget(@User() user, @Body() budgetDto: CreateBudgetDto) {
    this.logger.log(`Creating budget for user: ${user.userId}`);
    budgetDto.userId = user.userId;
    return await firstValueFrom(
      this.financeClient.send({ cmd: BudgetCommands.CREATE }, budgetDto)
    );
  }

  @ApiTags('budget')
  @ApiOperation({ summary: 'Get a budget by ID' })
  @ApiResponse({
    status: 200,
    description: 'The budget has been successfully retrieved.',
    type: BudgetDto,
  })
  @Get('budget/:id')
  async getBudget(@Param('id') id: string): Promise<BudgetDto> {
    return await firstValueFrom(
      this.financeClient.send({ cmd: BudgetCommands.FIND }, { id })
    );
  }

  @ApiTags('budget')
  @ApiOperation({ summary: 'Get all budgets' })
  @ApiResponse({
    status: 200,
    description: 'The budgets have been successfully retrieved.',
    type: [BudgetDto],
  })
  @Get('budgets')
  async getAllBudgets(): Promise<BudgetDto[]> {
    return await firstValueFrom(
      this.financeClient.send({ cmd: BudgetCommands.FIND_MANY }, {})
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
  async updateBudget(
    @Param('id') id: string,
    @Body() updateBudgetDto: UpdateBudgetDto
  ): Promise<BudgetDto> {
    return await firstValueFrom(
      this.financeClient.send(
        { cmd: BudgetCommands.UPDATE },
        { id, data: updateBudgetDto }
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
  async deleteBudget(@Param('id') id: string): Promise<void> {
    return await firstValueFrom(
      this.financeClient.send({ cmd: BudgetCommands.DELETE }, { id })
    );
  }
}
