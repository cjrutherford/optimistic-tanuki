import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('flow_estimates')
@Unique(['tenantId', 'estimateId'])
@Unique(['tenantId', 'idempotencyKey'])
@Index(['tenantId', 'expiresAt'])
export class FlowEstimate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 128 })
  tenantId: string;

  @Column({ length: 64 })
  estimateId: string;

  @Column({ length: 200, nullable: true })
  idempotencyKey?: string | null;

  @Column({ length: 120 })
  serviceId: string;

  @Column({ length: 120 })
  servicePackage: string;

  @Column({ length: 160 })
  serviceName: string;

  @Column({ length: 32 })
  size: string;

  @Column({ length: 32 })
  condition: string;

  @Column({ type: 'int', nullable: true })
  squareFootage?: number | null;

  @Column({ length: 120, nullable: true })
  tradeType?: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  basePrice: number;

  @Column({ type: 'numeric', precision: 6, scale: 4 })
  conditionMultiplier: number;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  taxAmount: number;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  depositRequired: number;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  total: number;

  @Column({ length: 8, default: 'USD' })
  currency: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'jsonb' })
  pricingSnapshot: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
