import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Transaction } from '../../entities/transaction.entity';
import { Repository, FindOneOptions, FindManyOptions } from 'typeorm';
import {
  BankSyncResultDto,
  BankSyncSourceType,
  BankTransactionReviewStatus,
  CreateTransactionDto,
  UpdateTransactionDto,
} from '@optimistic-tanuki/models';
import { AccountService } from './account.service';
import DOMPurify from 'isomorphic-dompurify';
import {
  FinanceScope,
  withScopedFindManyOptions,
  withScopedFindOneOptions,
} from './finance-scope';

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

  private toScope(
    data:
      | Pick<
          CreateTransactionDto,
          'userId' | 'profileId' | 'appScope' | 'tenantId'
        >
      | FinanceScope
  ): FinanceScope {
    return {
      userId: data.userId,
      profileId: data.profileId,
      tenantId: data.tenantId,
      appScope: data.appScope,
    };
  }

  private signedAmount(amount: number, type: string): number {
    return type === 'credit' ? Number(amount) : -Number(amount);
  }

  async create(
    createTransactionDto: CreateTransactionDto
  ): Promise<Transaction> {
    const transaction = this.transactionRepo.create({
      ...createTransactionDto,
      description: createTransactionDto.description
        ? this.sanitizeContent(createTransactionDto.description)
        : undefined,
      category: createTransactionDto.category
        ? this.sanitizeContent(createTransactionDto.category)
        : undefined,
      payeeOrVendor: createTransactionDto.payeeOrVendor
        ? this.sanitizeContent(createTransactionDto.payeeOrVendor)
        : undefined,
      transferType: createTransactionDto.transferType ?? undefined,
      sourceType: createTransactionDto.sourceType ?? BankSyncSourceType.MANUAL,
      sourceProvider: createTransactionDto.sourceProvider ?? undefined,
      externalTransactionId: createTransactionDto.externalTransactionId ?? undefined,
      pending: createTransactionDto.pending ?? false,
      reviewStatus:
        createTransactionDto.reviewStatus ??
        BankTransactionReviewStatus.NEEDS_REVIEW,
    });

    const savedTransaction = await this.transactionRepo.save(transaction);

    // Update account balance
    const amount = this.signedAmount(
      createTransactionDto.amount,
      createTransactionDto.type
    );
    await this.accountService.updateBalance(
      createTransactionDto.accountId,
      amount,
      this.toScope(createTransactionDto)
    );

    return savedTransaction;
  }

  async findAll(
    scope?: FinanceScope,
    options?: FindManyOptions<Transaction>
  ): Promise<Transaction[]> {
    return await this.transactionRepo.find(
      withScopedFindManyOptions(scope, options)
    );
  }

  async findOne(
    id: string,
    scope?: FinanceScope,
    options?: FindOneOptions<Transaction>
  ): Promise<Transaction | null> {
    return await this.transactionRepo.findOne(
      withScopedFindOneOptions(id, scope, options)
    );
  }

  async update(
    id: string,
    updateTransactionDto: UpdateTransactionDto,
    scope?: FinanceScope
  ): Promise<Transaction> {
    const transaction = await this.findOne(id, scope);
    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    const updatedData: Partial<Transaction> = {};
    if (updateTransactionDto.amount !== undefined) {
      updatedData.amount = updateTransactionDto.amount;
    }
    if (updateTransactionDto.type) {
      updatedData.type = updateTransactionDto.type;
    }
    if (updateTransactionDto.accountId) {
      updatedData.accountId = updateTransactionDto.accountId;
    }
    if (updateTransactionDto.description !== undefined) {
      updatedData.description = updateTransactionDto.description
        ? this.sanitizeContent(updateTransactionDto.description)
        : null;
    }
    if (updateTransactionDto.category) {
      updatedData.category = this.sanitizeContent(
        updateTransactionDto.category
      );
    }
    if (updateTransactionDto.payeeOrVendor !== undefined) {
      updatedData.payeeOrVendor = updateTransactionDto.payeeOrVendor
        ? this.sanitizeContent(updateTransactionDto.payeeOrVendor)
        : null;
    }
    if (updateTransactionDto.transferType !== undefined) {
      updatedData.transferType = updateTransactionDto.transferType ?? null;
    }
    if (updateTransactionDto.sourceType !== undefined) {
      updatedData.sourceType = updateTransactionDto.sourceType;
    }
    if (updateTransactionDto.sourceProvider !== undefined) {
      updatedData.sourceProvider = updateTransactionDto.sourceProvider ?? null;
    }
    if (updateTransactionDto.externalTransactionId !== undefined) {
      updatedData.externalTransactionId =
        updateTransactionDto.externalTransactionId ?? null;
    }
    if (updateTransactionDto.pending !== undefined) {
      updatedData.pending = updateTransactionDto.pending;
    }
    if (updateTransactionDto.reviewStatus !== undefined) {
      updatedData.reviewStatus = updateTransactionDto.reviewStatus;
    }
    if (updateTransactionDto.transactionDate) {
      updatedData.transactionDate = updateTransactionDto.transactionDate;
    }
    if (updateTransactionDto.reference !== undefined) {
      updatedData.reference = updateTransactionDto.reference
        ? this.sanitizeContent(updateTransactionDto.reference)
        : null;
    }
    if (updateTransactionDto.isRecurring !== undefined) {
      updatedData.isRecurring = updateTransactionDto.isRecurring;
    }
    if (updateTransactionDto.workspace) {
      updatedData.workspace = updateTransactionDto.workspace;
    }

    const nextAccountId = updatedData.accountId ?? transaction.accountId;
    const nextType = updatedData.type ?? transaction.type;
    const nextAmount = Number(updatedData.amount ?? transaction.amount);
    const previousSignedAmount = this.signedAmount(
      Number(transaction.amount),
      transaction.type
    );
    const nextSignedAmount = this.signedAmount(nextAmount, nextType);

    if (transaction.accountId !== nextAccountId) {
      await this.accountService.updateBalance(
        transaction.accountId,
        -previousSignedAmount,
        scope
      );
      await this.accountService.updateBalance(
        nextAccountId,
        nextSignedAmount,
        scope
      );
    } else if (previousSignedAmount !== nextSignedAmount) {
      await this.accountService.updateBalance(
        transaction.accountId,
        nextSignedAmount - previousSignedAmount,
        scope
      );
    }

    await this.transactionRepo.update(id, updatedData);
    return await this.findOne(id, scope);
  }

  async remove(id: string, scope?: FinanceScope): Promise<void> {
    const transaction = await this.findOne(id, scope);
    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    const amount = -this.signedAmount(
      Number(transaction.amount),
      transaction.type
    );
    await this.accountService.updateBalance(
      transaction.accountId,
      amount,
      scope
    );

    await this.transactionRepo.delete(id);
  }

  async syncBankFeed(
    _connectionId: string,
    scope: FinanceScope,
    transactions: CreateTransactionDto[]
  ): Promise<BankSyncResultDto> {
    let added = 0;
    let modified = 0;

    const toSave: Transaction[] = [];
    for (const transactionInput of transactions) {
      if (!transactionInput.externalTransactionId) {
        const created = await this.create({
          ...transactionInput,
          sourceType: transactionInput.sourceType ?? BankSyncSourceType.BANK_SYNC,
        });
        toSave.push(created);
        added += 1;
        continue;
      }

      const existing = await this.transactionRepo.findOne({
        where: {
          externalTransactionId: transactionInput.externalTransactionId,
          userId: scope.userId,
          profileId: scope.profileId,
          appScope: scope.appScope,
          ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
        },
      });

      if (existing) {
        toSave.push(
          this.transactionRepo.create({
            ...existing,
            ...transactionInput,
            sourceType:
              transactionInput.sourceType ?? BankSyncSourceType.BANK_SYNC,
          })
        );
        modified += 1;
        continue;
      }

      const created = this.transactionRepo.create({
        ...transactionInput,
        sourceType: transactionInput.sourceType ?? BankSyncSourceType.BANK_SYNC,
        pending: transactionInput.pending ?? false,
        reviewStatus:
          transactionInput.reviewStatus ??
          BankTransactionReviewStatus.NEEDS_REVIEW,
      });
      toSave.push(created);
      added += 1;
      await this.accountService.updateBalance(
        transactionInput.accountId,
        this.signedAmount(transactionInput.amount, transactionInput.type),
        scope
      );
    }

    if (toSave.length) {
      await this.transactionRepo.save(toSave);
    }

    return { added, modified, removed: 0 };
  }
}
