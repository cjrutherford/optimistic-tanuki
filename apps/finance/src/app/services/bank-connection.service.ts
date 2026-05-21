import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Account,
  BankConnection,
  LinkedBankAccount,
} from '../../entities';
import { Repository } from 'typeorm';
import {
  BankConnectionCreateDto,
  BankConnectionExchangeDto,
  BankConnectionDto,
  BankConnectionLinkTokenDto,
  BankConnectionStatus,
  BankLinkTokenResponseDto,
  BankSyncResultDto,
  BankSyncSourceType,
  BankTransactionReviewStatus,
  CreateTransactionDto,
} from '@optimistic-tanuki/models';
import { AccountService } from './account.service';
import { TransactionService } from './transaction.service';
import { PlaidBankProviderService } from './plaid-bank-provider.service';
import {
  FinanceScope,
  withScopedFindManyOptions,
  withScopedFindOneOptions,
} from './finance-scope';

@Injectable()
export class BankConnectionService {
  constructor(
    @Inject(getRepositoryToken(BankConnection))
    private readonly connectionRepo: Repository<BankConnection>,
    @Inject(getRepositoryToken(LinkedBankAccount))
    private readonly linkedAccountRepo: Repository<LinkedBankAccount>,
    @Inject(getRepositoryToken(Account))
    private readonly accountRepo: Repository<Account>,
    private readonly accountService: AccountService,
    private readonly transactionService: TransactionService,
    private readonly plaidProvider: PlaidBankProviderService
  ) {}

  async createLinkToken(
    payload: BankConnectionLinkTokenDto & {
      userId: string;
      profileId: string;
    }
  ): Promise<BankLinkTokenResponseDto> {
    return this.plaidProvider.createLinkToken(payload);
  }

  async exchangePublicToken(
    payload: BankConnectionExchangeDto & FinanceScope
  ): Promise<BankConnection> {
    const exchange = await this.plaidProvider.exchangePublicToken(payload);
    return this.createConnection({
      provider: payload.provider,
      publicToken: payload.publicToken,
      workspace: payload.workspace,
      status: BankConnectionStatus.HEALTHY,
      itemId: exchange.itemId,
      accessToken: exchange.accessToken,
      institutionId: exchange.institutionId,
      institutionName: exchange.institutionName,
      accounts: exchange.accounts,
      userId: payload.userId!,
      profileId: payload.profileId!,
      tenantId: payload.tenantId!,
      appScope: payload.appScope!,
    });
  }

  async listConnections(scope: FinanceScope): Promise<BankConnectionDto[]> {
    return this.connectionRepo.find(
      withScopedFindManyOptions(scope, {
        relations: {
          linkedAccounts: true,
        },
      })
    ) as Promise<BankConnectionDto[]>;
  }

  async findConnection(
    id: string,
    scope: FinanceScope
  ): Promise<BankConnection | null> {
    return this.connectionRepo.findOne(
      withScopedFindOneOptions(id, scope, {
        relations: {
          linkedAccounts: true,
        },
      })
    );
  }

  async createConnection(
    payload: BankConnectionCreateDto
  ): Promise<BankConnection> {
    const connection = await this.connectionRepo.save(
      this.connectionRepo.create({
        provider: payload.provider,
        itemId: payload.itemId,
        accessToken: payload.accessToken,
        institutionId: payload.institutionId,
        institutionName: payload.institutionName,
        status: payload.status,
        userId: payload.userId,
        profileId: payload.profileId,
        tenantId: payload.tenantId,
        appScope: payload.appScope,
      })
    );

    const linkedAccounts: LinkedBankAccount[] = [];
    for (const providerAccount of payload.accounts) {
      let financeAccount = await this.accountRepo.findOne({
        where: {
          providerAccountId: providerAccount.providerAccountId,
          userId: payload.userId,
          profileId: payload.profileId,
          appScope: payload.appScope,
          tenantId: payload.tenantId,
        },
      });

      if (!financeAccount) {
        financeAccount = await this.accountService.create({
          name: providerAccount.name,
          type: 'bank',
          balance: providerAccount.balance,
          currency: providerAccount.currency,
          workspace: payload.workspace,
          userId: payload.userId,
          profileId: payload.profileId,
          tenantId: payload.tenantId,
          appScope: payload.appScope,
          providerConnectionId: connection.id,
          providerAccountId: providerAccount.providerAccountId,
          institutionName: payload.institutionName,
        });
      }

      linkedAccounts.push(
        this.linkedAccountRepo.create({
          connectionId: connection.id,
          financeAccountId: financeAccount.id,
          providerAccountId: providerAccount.providerAccountId,
          name: providerAccount.name,
          mask: providerAccount.mask ?? null,
          subtype: providerAccount.subtype ?? null,
          providerType: providerAccount.type ?? null,
        })
      );
    }

    if (linkedAccounts.length) {
      await this.linkedAccountRepo.save(linkedAccounts);
    }

    await this.transactionService.syncBankFeed(connection.id, {
      userId: payload.userId,
      profileId: payload.profileId,
      tenantId: payload.tenantId,
      appScope: payload.appScope,
    }, []);

    return connection;
  }

  async disconnectConnection(
    id: string,
    scope: FinanceScope
  ): Promise<BankConnection> {
    const existing = await this.findConnection(id, scope);
    if (!existing) {
      throw new NotFoundException(`Bank connection with ID ${id} not found`);
    }

    await this.connectionRepo.update(id, {
      status: BankConnectionStatus.DISCONNECTED,
      isActive: false,
      lastError: null,
    });

    const updated = await this.findConnection(id, scope);
    if (!updated) {
      throw new NotFoundException(`Bank connection with ID ${id} not found`);
    }
    return updated;
  }

  async syncConnection(
    id: string,
    scope: FinanceScope,
    transactions: CreateTransactionDto[]
  ): Promise<BankSyncResultDto> {
    const connection = await this.findConnection(id, scope);
    if (!connection) {
      throw new NotFoundException(`Bank connection with ID ${id} not found`);
    }

    const linkedAccounts = await this.linkedAccountRepo.find({
      where: {
        connectionId: id,
      },
    });
    const accountMap = new Map(
      linkedAccounts.map((account) => [account.providerAccountId, account.financeAccountId])
    );
    const providerSync = await this.plaidProvider.syncTransactions(
      connection.accessToken,
      connection.lastCursor
    );
    const bankTransactions: CreateTransactionDto[] =
      transactions.length > 0
        ? transactions
        : providerSync.transactions
            .filter((transaction) => accountMap.has(transaction.providerAccountId))
            .map((transaction) => ({
              accountId: accountMap.get(transaction.providerAccountId)!,
              amount: Math.abs(transaction.amount),
              type: transaction.type,
              category: transaction.category,
              description: transaction.description,
              transactionDate: transaction.transactionDate,
              isRecurring: false,
              workspace: 'personal',
              sourceProvider: 'plaid',
              sourceType: BankSyncSourceType.BANK_SYNC,
              externalTransactionId: transaction.externalTransactionId,
              pending: transaction.pending,
              reviewStatus: transaction.pending
                ? BankTransactionReviewStatus.NEEDS_REVIEW
                : BankTransactionReviewStatus.REVIEWED,
              userId: scope.userId,
              profileId: scope.profileId,
              tenantId: scope.tenantId,
              appScope: scope.appScope,
            }));

    await this.connectionRepo.update(id, {
      lastAttemptedSyncAt: new Date(),
      status: BankConnectionStatus.HEALTHY,
      lastError: null,
    });

    const result = await this.transactionService.syncBankFeed(id, scope, bankTransactions);
    await this.connectionRepo.update(id, {
      lastSuccessfulSyncAt: new Date(),
      lastCursor: providerSync.nextCursor,
    });
    return result;
  }

  async processWebhook(payload: Record<string, unknown>): Promise<{ accepted: true }> {
    const itemId =
      typeof payload.item_id === 'string' ? payload.item_id : undefined;
    if (!itemId) {
      return { accepted: true };
    }

    const connection = await this.connectionRepo.findOne({
      where: { itemId },
    });
    if (!connection) {
      return { accepted: true };
    }

    await this.connectionRepo.update(connection.id, {
      status: this.plaidProvider.mapWebhookStatus(
        typeof payload.webhook_code === 'string' ? payload.webhook_code : undefined
      ),
    });
    return { accepted: true };
  }
}
