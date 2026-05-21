import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Account } from '../../entities/account.entity';
import { Repository, FindOneOptions, FindManyOptions } from 'typeorm';
import {
  CreateAccountDto,
  UpdateAccountDto,
} from '@optimistic-tanuki/models';
import DOMPurify from 'isomorphic-dompurify';
import {
  FinanceScope,
  withScopedFindManyOptions,
  withScopedFindOneOptions,
} from './finance-scope';

@Injectable()
export class AccountService {
  constructor(
    @Inject(getRepositoryToken(Account))
    private readonly accountRepo: Repository<Account>
  ) {}

  private sanitizeContent(content: string): string {
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });
  }

  async create(createAccountDto: CreateAccountDto): Promise<Account> {
    const account = this.accountRepo.create({
      ...createAccountDto,
      name: this.sanitizeContent(createAccountDto.name),
      description: createAccountDto.description ? this.sanitizeContent(createAccountDto.description) : undefined,
    });
    return await this.accountRepo.save(account);
  }

  async findAll(
    scope?: FinanceScope,
    options?: FindManyOptions<Account>
  ): Promise<Account[]> {
    return await this.accountRepo.find(withScopedFindManyOptions(scope, options));
  }

  async findOne(
    id: string,
    scope?: FinanceScope,
    options?: FindOneOptions<Account>
  ): Promise<Account | null> {
    return await this.accountRepo.findOne(
      withScopedFindOneOptions(id, scope, options)
    );
  }

  async update(
    id: string,
    updateAccountDto: UpdateAccountDto,
    scope?: FinanceScope
  ): Promise<Account> {
    const account = await this.findOne(id, scope);
    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }
    
    const updatedData: Partial<Account> = {};
    if (updateAccountDto.name) {
      updatedData.name = this.sanitizeContent(updateAccountDto.name);
    }
    if (updateAccountDto.description !== undefined) {
      updatedData.description = updateAccountDto.description ? this.sanitizeContent(updateAccountDto.description) : null;
    }
    if (updateAccountDto.balance !== undefined) {
      updatedData.balance = updateAccountDto.balance;
    }
    if (updateAccountDto.isActive !== undefined) {
      updatedData.isActive = updateAccountDto.isActive;
    }
    if (updateAccountDto.type) {
      updatedData.type = updateAccountDto.type;
    }
    if (updateAccountDto.workspace) {
      updatedData.workspace = updateAccountDto.workspace;
    }
    if (updateAccountDto.lastReviewedAt !== undefined) {
      updatedData.lastReviewedAt = updateAccountDto.lastReviewedAt;
    }
    if (updateAccountDto.providerConnectionId !== undefined) {
      updatedData.providerConnectionId = updateAccountDto.providerConnectionId;
    }
    if (updateAccountDto.providerAccountId !== undefined) {
      updatedData.providerAccountId = updateAccountDto.providerAccountId;
    }
    if (updateAccountDto.institutionName !== undefined) {
      updatedData.institutionName = updateAccountDto.institutionName;
    }

    await this.accountRepo.update(id, updatedData);
    return await this.findOne(id, scope);
  }

  async remove(id: string, scope?: FinanceScope): Promise<void> {
    const account = await this.findOne(id, scope);
    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    await this.accountRepo.delete(id);
  }

  async updateBalance(
    id: string,
    amount: number,
    scope?: FinanceScope
  ): Promise<Account> {
    const account = await this.findOne(id, scope);
    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }
    
    const newBalance = Number(account.balance) + amount;
    await this.accountRepo.update(id, { balance: newBalance });
    return await this.findOne(id, scope);
  }
}
