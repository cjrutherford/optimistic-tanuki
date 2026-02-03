import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Transaction } from '../../entities/transaction.entity';
import { Repository, FindOneOptions, FindManyOptions } from 'typeorm';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
} from '@optimistic-tanuki/models';
import { AccountService } from './account.service';
import DOMPurify from 'isomorphic-dompurify';

@Injectable()
export class TransactionService {
  constructor(
    @Inject(getRepositoryToken(Transaction))
    private readonly transactionRepo: Repository<Transaction>,
    private readonly accountService: AccountService
  ) {}

  private sanitizeContent(content: string): string {
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });
  }

  async create(createTransactionDto: CreateTransactionDto): Promise<Transaction> {
    const transaction = this.transactionRepo.create({
      ...createTransactionDto,
      description: createTransactionDto.description ? this.sanitizeContent(createTransactionDto.description) : undefined,
      category: this.sanitizeContent(createTransactionDto.category),
    });
    
    const savedTransaction = await this.transactionRepo.save(transaction);
    
    // Update account balance
    const amount = createTransactionDto.type === 'credit' ? 
      Number(createTransactionDto.amount) : 
      -Number(createTransactionDto.amount);
    await this.accountService.updateBalance(createTransactionDto.accountId, amount);
    
    return savedTransaction;
  }

  async findAll(options?: FindManyOptions<Transaction>): Promise<Transaction[]> {
    return await this.transactionRepo.find(options);
  }

  async findOne(
    id: string,
    options?: FindOneOptions<Transaction>
  ): Promise<Transaction | null> {
    return await this.transactionRepo.findOne({
      where: { id },
      ...options,
    });
  }

  async update(id: string, updateTransactionDto: UpdateTransactionDto): Promise<Transaction> {
    const transaction = await this.findOne(id);
    if (!transaction) {
      throw new Error(`Transaction with ID ${id} not found`);
    }
    
    const updatedData: Partial<Transaction> = {};
    if (updateTransactionDto.description !== undefined) {
      updatedData.description = updateTransactionDto.description ? this.sanitizeContent(updateTransactionDto.description) : null;
    }
    if (updateTransactionDto.category) {
      updatedData.category = this.sanitizeContent(updateTransactionDto.category);
    }
    if (updateTransactionDto.transactionDate) {
      updatedData.transactionDate = updateTransactionDto.transactionDate;
    }

    await this.transactionRepo.update(id, updatedData);
    return await this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const transaction = await this.findOne(id);
    if (!transaction) {
      throw new Error(`Transaction with ID ${id} not found`);
    }
    
    // Reverse the balance change
    const amount = transaction.type === 'credit' ? 
      -Number(transaction.amount) : 
      Number(transaction.amount);
    await this.accountService.updateBalance(transaction.accountId, amount);
    
    await this.transactionRepo.delete(id);
  }
}
