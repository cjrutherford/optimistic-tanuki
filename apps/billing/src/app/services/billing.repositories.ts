import {
  InvoiceLine,
  InvoicePreview,
  UsageBlockGrant,
  UsageEvent,
} from '@optimistic-tanuki/billing-contracts';

export const USAGE_EVENT_REPOSITORY = Symbol('USAGE_EVENT_REPOSITORY');
export const USAGE_BLOCK_REPOSITORY = Symbol('USAGE_BLOCK_REPOSITORY');
export const INVOICE_REPOSITORY = Symbol('INVOICE_REPOSITORY');

export interface UsageEventRepository {
  findByEventKey(
    tenantId: string,
    appScope: string,
    eventKey: string
  ): Promise<UsageEvent | undefined>;

  save(event: UsageEvent): Promise<UsageEvent>;

  findByMeterAndPeriod(input: {
    tenantId: string;
    appScope: string;
    meterId: string;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<UsageEvent[]>;
}

export interface UsageBlockRepository {
  save(grant: UsageBlockGrant): Promise<UsageBlockGrant>;

  findAvailable(input: {
    tenantId: string;
    appScope: string;
    accountId: string;
    meterId: string;
    at: Date;
  }): Promise<UsageBlockGrant[]>;
}

export interface MintedInvoice {
  id: string;
}

export interface InvoiceRepository {
  mint(input: {
    tenantId: string;
    appScope: string;
    accountId?: string;
    currency: string;
    subtotalCents: number;
    lines: InvoiceLine[];
    appointmentId?: string;
    orderId?: string;
  }): Promise<MintedInvoice>;
}
