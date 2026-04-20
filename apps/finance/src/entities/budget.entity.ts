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
export class Budget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  category: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  limit: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  spent: number;

  @Column()
  period: string; // 'daily', 'weekly', 'monthly', 'yearly'

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

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

  @Column({ type: 'boolean', default: false })
  alertOnExceed: boolean;

  @ManyToOne(() => FinanceTenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: FinanceTenant;
}
