import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  BankConnectionExchangeDto,
  BankConnectionLinkTokenDto,
  BankConnectionStatus,
  BankLinkTokenResponseDto,
  BankProviderAccountDto,
} from '@optimistic-tanuki/models';

type PlaidExchangeResult = {
  accessToken: string;
  itemId: string;
  institutionId?: string;
  institutionName?: string;
  accounts: BankProviderAccountDto[];
};

@Injectable()
export class PlaidBankProviderService {
  private readonly clientId = process.env.PLAID_CLIENT_ID ?? '';
  private readonly secret = process.env.PLAID_SECRET ?? '';
  private readonly env = process.env.PLAID_ENV ?? 'sandbox';
  private readonly clientName =
    process.env.PLAID_CLIENT_NAME ?? 'Fin Commander';

  private baseUrl(): string {
    if (this.env === 'production') {
      return 'https://production.plaid.com';
    }

    if (this.env === 'development') {
      return 'https://development.plaid.com';
    }

    return 'https://sandbox.plaid.com';
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    if (!this.clientId || !this.secret) {
      throw new InternalServerErrorException(
        'Plaid is not configured. Set PLAID_CLIENT_ID and PLAID_SECRET.'
      );
    }

    const response = await fetch(`${this.baseUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        secret: this.secret,
        ...body,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new InternalServerErrorException(
        `Plaid request failed: ${response.status} ${errorBody}`
      );
    }

    return (await response.json()) as T;
  }

  async createLinkToken(
    payload: BankConnectionLinkTokenDto & {
      userId: string;
      profileId: string;
    }
  ): Promise<BankLinkTokenResponseDto> {
    const result = await this.request<{
      link_token: string;
      expiration?: string;
    }>('/link/token/create', {
      client_name: this.clientName,
      language: 'en',
      country_codes: ['US'],
      user: {
        client_user_id: `${payload.userId}:${payload.profileId}`,
      },
      products: ['transactions'],
      redirect_uri: payload.redirectUri,
    });

    return {
      provider: 'plaid',
      linkToken: result.link_token,
      expiration: result.expiration,
    };
  }

  async exchangePublicToken(
    payload: BankConnectionExchangeDto
  ): Promise<PlaidExchangeResult> {
    const exchange = await this.request<{
      access_token: string;
      item_id: string;
    }>('/item/public_token/exchange', {
      public_token: payload.publicToken,
    });

    const accountsResponse = await this.request<{
      accounts: Array<{
        account_id: string;
        balances: { current: number | null };
        mask?: string;
        name: string;
        subtype?: string;
        type?: string;
      }>;
    }>('/accounts/get', {
      access_token: exchange.access_token,
    });

    return {
      accessToken: exchange.access_token,
      itemId: exchange.item_id,
      institutionId: payload.institutionId,
      institutionName: payload.institutionName,
      accounts: accountsResponse.accounts.map((account) => ({
        providerAccountId: account.account_id,
        name: account.name,
        mask: account.mask,
        subtype: account.subtype,
        type: account.type,
        balance: Number(account.balances.current ?? 0),
        currency: 'USD',
      })),
    };
  }

  async syncTransactions(
    accessToken: string,
    cursor?: string | null
  ): Promise<{
    nextCursor: string | null;
    transactions: Array<{
      externalTransactionId: string;
      providerAccountId: string;
      amount: number;
      type: 'credit' | 'debit';
      category: string;
      description: string;
      transactionDate: Date;
      pending: boolean;
    }>;
  }> {
    const added: Array<{
      transaction_id: string;
      account_id: string;
      amount: number;
      date: string;
      merchant_name?: string;
      name: string;
      category?: string[];
      pending: boolean;
    }> = [];

    let hasMore = true;
    let nextCursor = cursor ?? null;
    while (hasMore) {
      const response = await this.request<{
        added: typeof added;
        has_more: boolean;
        next_cursor: string | null;
      }>('/transactions/sync', {
        access_token: accessToken,
        cursor: nextCursor ?? undefined,
      });

      added.push(...response.added);
      hasMore = response.has_more;
      nextCursor = response.next_cursor;
    }

    return {
      nextCursor,
      transactions: added.map((transaction) => ({
        externalTransactionId: transaction.transaction_id,
        providerAccountId: transaction.account_id,
        amount: Number(transaction.amount),
        type: Number(transaction.amount) < 0 ? 'credit' : 'debit',
        category: transaction.category?.[0] ?? 'Imported',
        description: transaction.merchant_name ?? transaction.name,
        transactionDate: new Date(transaction.date),
        pending: transaction.pending,
      })),
    };
  }

  mapWebhookStatus(code?: string): BankConnectionStatus {
    if (code === 'ERROR' || code === 'LOGIN_REPAIRED') {
      return BankConnectionStatus.SYNC_ERROR;
    }

    if (code === 'PENDING_EXPIRATION') {
      return BankConnectionStatus.NEEDS_REAUTH;
    }

    return BankConnectionStatus.HEALTHY;
  }
}
