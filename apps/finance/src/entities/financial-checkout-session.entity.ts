import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  FinanceWorkspace,
  FinancialCheckoutSessionStatus,
} from '@optimistic-tanuki/models';
import { FinanceTenant } from './finance-tenant.entity';
import { FinancialInvoice } from './financial-invoice.entity';

@Entity()
export class FinancialCheckoutSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  profileId: string;

  @Column('uuid')
  tenantId: string;

  @Column({ type: 'varchar', default: 'finance' })
  appScope: string;

  @Column({ type: 'varchar', default: 'business' })
  workspace: FinanceWorkspace;

  @Column('uuid', { nullable: true })
  invoiceId: string | null;

  @ManyToOne(() => FinancialInvoice, { nullable: true })
  @JoinColumn({ name: 'invoiceId' })
  invoice: FinancialInvoice | null;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column()
  customerName: string;

  @Column({ type: 'varchar', nullable: true })
  customerEmail: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  providerReference: string | null;

  @Column({ type: 'text', nullable: true })
  providerCheckoutUrl: string | null;

  @Column({ type: 'varchar', default: 'pending_provider' })
  status: FinancialCheckoutSessionStatus;

  @Column({ type: 'text', nullable: true })
  successUrl: string | null;

  @Column({ type: 'text', nullable: true })
  cancelUrl: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @ManyToOne(() => FinanceTenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: FinanceTenant;
}
