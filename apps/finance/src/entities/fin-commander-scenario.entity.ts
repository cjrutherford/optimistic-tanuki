import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FinanceTenant } from './finance-tenant.entity';
import { FinCommanderPlanEntity } from './fin-commander-plan.entity';

export interface FinCommanderScenarioAssumptionRecord {
  id: string;
  label: string;
  delta: string;
  impactArea: 'income' | 'spend' | 'savings' | 'debt';
}

@Entity('fin_commander_scenario')
export class FinCommanderScenarioEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  planId: string;

  @Column()
  name: string;

  @Column({ type: 'text', default: '' })
  summary: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  assumptions: FinCommanderScenarioAssumptionRecord[];

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
