import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { InvoiceLine } from '@optimistic-tanuki/billing-contracts';

export type BillingInvoiceStatus = 'draft' | 'open' | 'paid' | 'void';

/**
 * Minted invoice quotes (E5, mint-on-preview decided). Every preview writes
 * one `draft` row; sending/paying transitions happen here later. `lines` is
 * jsonb — line shapes are validated by `billing-contracts` DTOs, not by
 * columns. `appointmentId`/`orderId` link store-originated quotes.
 */
@Entity()
export class BillingInvoiceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column({ type: 'varchar', default: 'billing' })
  appScope: string;

  @Column({ type: 'uuid', nullable: true })
  accountId: string | null;

  @Column({ type: 'varchar', default: 'draft' })
  status: BillingInvoiceStatus;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'int', default: 0 })
  subtotalCents: number;

  @Column({ type: 'jsonb', default: [] })
  lines: InvoiceLine[];

  @Column({ type: 'uuid', nullable: true })
  appointmentId: string | null;

  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
