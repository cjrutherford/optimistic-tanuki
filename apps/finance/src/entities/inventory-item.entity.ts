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
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  unitValue: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalValue: number;

  @Column()
  category: string;

  @Column()
  userId: string;

  @Column()
  profileId: string;

  @Column('uuid')
  tenantId: string;

  @Column({ type: 'varchar', default: 'finance' })
  appScope: string;

  @Column({ type: 'varchar', default: 'net-worth' })
  workspace: FinanceWorkspace;

  @Column({ type: 'varchar', nullable: true })
  sku: string;

  @Column({ type: 'varchar', nullable: true })
  location: string;

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
