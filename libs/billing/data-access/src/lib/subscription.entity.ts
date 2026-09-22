import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BillingSubscriptionStatus } from '@optimistic-tanuki/billing-contracts';

/**
 * Canonical subscription lifecycle (E7). The billing service owns
 * create/cancel/status transitions; store keeps a read-only
 * `product_entitlements` mirror keyed by `billingSubscriptionId`.
 */
@Entity()
export class BillingSubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column({ type: 'varchar', default: 'billing' })
  appScope: string;

  @Column({ type: 'uuid' })
  accountId: string;

  @Column()
  planId: string;

  @Column()
  priceId: string;

  @Column({ type: 'varchar', default: 'trialing' })
  status: BillingSubscriptionStatus;

  @Column({ type: 'timestamp', nullable: true })
  currentPeriodStart: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  currentPeriodEnd: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  canceledAt: Date | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
