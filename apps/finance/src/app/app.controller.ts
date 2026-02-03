import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AccountCommands,
  TransactionCommands,
  InventoryItemCommands,
  BudgetCommands,
} from '@optimistic-tanuki/constants';
import {
  CreateAccountDto,
  UpdateAccountDto,
  CreateTransactionDto,
  UpdateTransactionDto,
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  CreateBudgetDto,
  UpdateBudgetDto,
} from '@optimistic-tanuki/models';
import { AccountService } from './services/account.service';
import { TransactionService } from './services/transaction.service';
import { InventoryItemService } from './services/inventory-item.service';
import { BudgetService } from './services/budget.service';
import { FindManyOptions } from 'typeorm';
import { Account, Transaction, InventoryItem, Budget } from '../entities';

@Controller()
export class AppController {
  constructor(
    private readonly accountService: AccountService,
    private readonly transactionService: TransactionService,
    private readonly inventoryItemService: InventoryItemService,
    private readonly budgetService: BudgetService
  ) {}

  // Account endpoints
  @MessagePattern({ cmd: AccountCommands.CREATE })
  async createAccount(@Payload() data: CreateAccountDto) {
    return await this.accountService.create(data);
  }

  @MessagePattern({ cmd: AccountCommands.FIND_MANY })
  async findAllAccounts(@Payload() options?: FindManyOptions<Account>) {
    return await this.accountService.findAll(options);
  }

  @MessagePattern({ cmd: AccountCommands.FIND })
  async findOneAccount(@Payload('id') id: string) {
    return await this.accountService.findOne(id);
  }

  @MessagePattern({ cmd: AccountCommands.UPDATE })
  async updateAccount(
    @Payload('id') id: string,
    @Payload('data') data: UpdateAccountDto
  ) {
    return await this.accountService.update(id, data);
  }

  @MessagePattern({ cmd: AccountCommands.DELETE })
  async removeAccount(@Payload('id') id: string) {
    return await this.accountService.remove(id);
  }

  // Transaction endpoints
  @MessagePattern({ cmd: TransactionCommands.CREATE })
  async createTransaction(@Payload() data: CreateTransactionDto) {
    return await this.transactionService.create(data);
  }

  @MessagePattern({ cmd: TransactionCommands.FIND_MANY })
  async findAllTransactions(@Payload() options?: FindManyOptions<Transaction>) {
    return await this.transactionService.findAll(options);
  }

  @MessagePattern({ cmd: TransactionCommands.FIND })
  async findOneTransaction(@Payload('id') id: string) {
    return await this.transactionService.findOne(id);
  }

  @MessagePattern({ cmd: TransactionCommands.UPDATE })
  async updateTransaction(
    @Payload('id') id: string,
    @Payload('data') data: UpdateTransactionDto
  ) {
    return await this.transactionService.update(id, data);
  }

  @MessagePattern({ cmd: TransactionCommands.DELETE })
  async removeTransaction(@Payload('id') id: string) {
    return await this.transactionService.remove(id);
  }

  // Inventory Item endpoints
  @MessagePattern({ cmd: InventoryItemCommands.CREATE })
  async createInventoryItem(@Payload() data: CreateInventoryItemDto) {
    return await this.inventoryItemService.create(data);
  }

  @MessagePattern({ cmd: InventoryItemCommands.FIND_MANY })
  async findAllInventoryItems(@Payload() options?: FindManyOptions<InventoryItem>) {
    return await this.inventoryItemService.findAll(options);
  }

  @MessagePattern({ cmd: InventoryItemCommands.FIND })
  async findOneInventoryItem(@Payload('id') id: string) {
    return await this.inventoryItemService.findOne(id);
  }

  @MessagePattern({ cmd: InventoryItemCommands.UPDATE })
  async updateInventoryItem(
    @Payload('id') id: string,
    @Payload('data') data: UpdateInventoryItemDto
  ) {
    return await this.inventoryItemService.update(id, data);
  }

  @MessagePattern({ cmd: InventoryItemCommands.DELETE })
  async removeInventoryItem(@Payload('id') id: string) {
    return await this.inventoryItemService.remove(id);
  }

  // Budget endpoints
  @MessagePattern({ cmd: BudgetCommands.CREATE })
  async createBudget(@Payload() data: CreateBudgetDto) {
    return await this.budgetService.create(data);
  }

  @MessagePattern({ cmd: BudgetCommands.FIND_MANY })
  async findAllBudgets(@Payload() options?: FindManyOptions<Budget>) {
    return await this.budgetService.findAll(options);
  }

  @MessagePattern({ cmd: BudgetCommands.FIND })
  async findOneBudget(@Payload('id') id: string) {
    return await this.budgetService.findOne(id);
  }

  @MessagePattern({ cmd: BudgetCommands.UPDATE })
  async updateBudget(
    @Payload('id') id: string,
    @Payload('data') data: UpdateBudgetDto
  ) {
    return await this.budgetService.update(id, data);
  }

  @MessagePattern({ cmd: BudgetCommands.DELETE })
  async removeBudget(@Payload('id') id: string) {
    return await this.budgetService.remove(id);
  }
}
