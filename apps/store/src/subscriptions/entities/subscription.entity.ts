import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ProductEntity } from '../../products/entities/product.entity';

@Entity('product_entitlements')
export class SubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  productId: string;

  @ManyToOne(() => ProductEntity)
  @JoinColumn({ name: 'productId' })
  product: ProductEntity;

  @Column({ type: 'varchar', length: 50 })
  status: string; // 'active', 'cancelled', 'expired' — read-only mirror of the canonical billing status

  // E7: reference to the canonical billing subscription. Written by the
  // gateway dual-write (billing create first); the table drops at O14.
  @Column({ type: 'uuid', nullable: true })
  billingSubscriptionId: string | null;

  @Column({ type: 'varchar', length: 50 })
  interval: string; // 'monthly', 'yearly'

  @Column({ type: 'timestamp', nullable: true })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  nextBillingDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
