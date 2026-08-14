import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FinanceTenant } from './finance-tenant.entity';
import { FinCommanderGoalEntity } from './fin-commander-goal.entity';
import { RecurringItem } from './recurring-item.entity';

@Entity('fin_commander_funding_directive')
export class FinCommanderFundingDirectiveEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  goalId: string;

  @Column('uuid', { nullable: true })
  recurringItemId: string | null;

  @Column('int')
  amountCents: number;

  @Column({ type: 'varchar', default: 'monthly' })
  cadence: string;

  @Column({ type: 'date' })
  startDate: string;

  @Column('uuid')
  fundingAccountId: string;

  @Column({ type: 'varchar', default: 'approved' })
  status: 'approved' | 'cancelled';

  @Column()
  userId: string;

  @Column()
  profileId: string;

  @Column('uuid')
  tenantId: string;

  @Column({ type: 'varchar', default: 'finance' })
  appScope: string;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ nullable: true })
  approvedByUserId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  @Column({ nullable: true })
  cancelledByUserId: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @ManyToOne(() => FinCommanderGoalEntity)
  @JoinColumn({ name: 'goalId' })
  goal: FinCommanderGoalEntity;

  @ManyToOne(() => RecurringItem, { nullable: true })
  @JoinColumn({ name: 'recurringItemId' })
  recurringItem: RecurringItem | null;

  @ManyToOne(() => FinanceTenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: FinanceTenant;
}
