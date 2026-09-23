import { Inject, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import {
  BillingSubscription,
  BillingSubscriptionStatus,
} from '@optimistic-tanuki/billing-contracts';
import {
  BillingSubscriptionEntity,
  StoreProductPlanEntity,
} from '@optimistic-tanuki/billing-data-access';

/**
 * Canonical subscription lifecycle (E7, decided: billing owns it).
 * State machine: trialing|active → past_due → active|canceled. Cancel is
 * terminal. Store keeps a read-only `product_entitlements` mirror keyed by
 * the ids minted here.
 */
@Injectable()
export class BillingSubscriptionsService {
  private readonly subscriptions: Repository<BillingSubscriptionEntity>;
  private readonly planMap: Repository<StoreProductPlanEntity>;

  constructor(@Inject('BILLING_CONNECTION') dataSource: DataSource) {
    this.subscriptions = dataSource.getRepository(BillingSubscriptionEntity);
    this.planMap = dataSource.getRepository(StoreProductPlanEntity);
  }

  async resolvePlan(productId: string): Promise<
    | {
        planId: string;
        priceId: string;
        amountCents: number;
        interval: string;
      }
    | undefined
  > {
    const row = await this.planMap.findOne({ where: { productId } });
    return row ?? undefined;
  }

  async create(input: {
    tenantId: string;
    appScope: string;
    accountId: string;
    planId: string;
    priceId: string;
  }): Promise<BillingSubscription> {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    const saved = await this.subscriptions.save(
      this.subscriptions.create({
        tenantId: input.tenantId,
        appScope: input.appScope,
        accountId: input.accountId,
        planId: input.planId,
        priceId: input.priceId,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        canceledAt: null,
      })
    );

    return this.toContract(saved);
  }

  /**
   * Store-originated create (E7): resolves `productId` through the override
   * mapping table, else derives `store:<productId>` plan/price ids. Period
   * length follows the store interval (`yearly` → 12 months, else 1).
   */
  async createFromProduct(input: {
    tenantId: string;
    appScope: string;
    accountId: string;
    productId: string;
    interval?: string;
  }): Promise<BillingSubscription> {
    const mapped = await this.resolvePlan(input.productId);
    const interval = input.interval ?? 'monthly';
    const planId = mapped?.planId ?? `store:${input.productId}`;
    const priceId = mapped?.priceId ?? `store:${input.productId}:${interval}`;
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + (interval === 'yearly' ? 12 : 1));
    const saved = await this.subscriptions.save(
      this.subscriptions.create({
        tenantId: input.tenantId,
        appScope: input.appScope,
        accountId: input.accountId,
        planId,
        priceId,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        canceledAt: null,
      })
    );

    return this.toContract(saved);
  }
  async get(id: string): Promise<BillingSubscription | undefined> {
    const row = await this.subscriptions.findOne({ where: { id } });
    return row ? this.toContract(row) : undefined;
  }

  async cancel(
    id: string
  ): Promise<BillingSubscription | { success: false; message: string }> {
    const row = await this.subscriptions.findOne({ where: { id } });
    if (!row) {
      return { success: false, message: 'Subscription not found' };
    }
    if (row.status === 'canceled') {
      return this.toContract(row);
    }
    row.status = 'canceled';
    row.canceledAt = new Date();
    return this.toContract(await this.subscriptions.save(row));
  }

  private toContract(row: BillingSubscriptionEntity): BillingSubscription {
    return {
      id: row.id,
      tenantId: row.tenantId,
      appScope: row.appScope,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      accountId: row.accountId,
      planId: row.planId,
      priceId: row.priceId,
      status: row.status as BillingSubscriptionStatus,
      currentPeriodStart: row.currentPeriodStart as Date,
      currentPeriodEnd: row.currentPeriodEnd as Date,
    };
  }
}
