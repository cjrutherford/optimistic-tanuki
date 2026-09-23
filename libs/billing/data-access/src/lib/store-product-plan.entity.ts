import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Store-product → billing plan/price mapping (E7).
 *
 * Resolution order for a store subscription create: explicit mapping row
 * first, otherwise the product's own `priceCents` with a derived
 * `month`/`one_time` interval. The table starts empty on purpose — inventing
 * plan prices for existing products would be wrong; overrides land here when
 * merchandising defines them.
 */
@Entity()
export class StoreProductPlanEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  productId: string;

  @Column()
  planId: string;

  @Column()
  priceId: string;

  @Column({ type: 'int' })
  amountCents: number;

  @Column({ type: 'varchar', length: 20, default: 'month' })
  interval: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
