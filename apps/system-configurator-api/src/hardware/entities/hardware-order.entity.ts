import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sc_hardware_orders')
export class HardwareOrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'jsonb' })
  configuration!: Record<string, unknown>;

  @Column({ type: 'jsonb' })
  priceBreakdown!: Record<string, unknown>;

  @Column({ type: 'jsonb' })
  shippingAddress!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 255 })
  customerEmail!: string;

  @Column({ type: 'varchar', length: 32 })
  paymentMethod!: string;

  @Column({ type: 'varchar', length: 32 })
  status!: string;

  @Column({ type: 'timestamp', nullable: true })
  estimatedDelivery!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
