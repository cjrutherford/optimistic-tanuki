import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FinanceWorkspace } from '@optimistic-tanuki/models';
import { FinanceTenant } from './finance-tenant.entity';

@Entity()
export class RecurringItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column()
  type: string;

  @Column({ nullable: true })
  category: string;

  @Column()
  cadence: string;

  @Column({ type: 'timestamp' })
  nextDueDate: Date;

  @Column({ default: 'scheduled' })
  status: string;

  @Column({ nullable: true })
  payeeOrVendor: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column('uuid', { nullable: true })
  accountId: string;

  @Column()
  userId: string;

  @Column()
  profileId: string;

  @Column('uuid')
  tenantId: string;

  @Column({ type: 'varchar', default: 'finance' })
  appScope: string;

  @Column({ type: 'varchar', default: 'personal' })
  workspace: FinanceWorkspace;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => FinanceTenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: FinanceTenant;
}
