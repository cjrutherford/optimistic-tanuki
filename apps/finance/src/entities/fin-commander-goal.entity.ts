import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FinanceTenant } from './finance-tenant.entity';
import { FinCommanderPlanEntity } from './fin-commander-plan.entity';

@Entity('fin_commander_goal')
export class FinCommanderGoalEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  planId: string;

  @Column()
  name: string;

  /** Target amount in integer cents. Never store money as a float. */
  @Column({ type: 'int' })
  targetAmountCents: number;

  /** Current amount in integer cents. Never store money as a float. */
  @Column({ type: 'int', default: 0 })
  currentAmountCents: number;

  @Column({ type: 'date' })
  dueDate: string;

  @Column({ type: 'text', default: '' })
  strategy: string;

  @Column()
  userId: string;

  @Column()
  profileId: string;

  @Column('uuid')
  tenantId: string;

  @Column({ type: 'varchar', default: 'finance' })
  appScope: string;

  @ManyToOne(() => FinCommanderPlanEntity)
  @JoinColumn({ name: 'planId' })
  plan: FinCommanderPlanEntity;

  @ManyToOne(() => FinanceTenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: FinanceTenant;

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
}
