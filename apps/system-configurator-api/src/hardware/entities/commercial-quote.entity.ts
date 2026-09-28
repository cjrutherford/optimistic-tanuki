import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('sc_commercial_quotes')
@Check(
  'CHK_sc_commercial_quotes_state',
  "\"state\" IN ('issued', 'accepted', 'expired', 'withdrawn')"
)
@Index('UQ_sc_commercial_quotes_idempotency_key', ['idempotencyKey'], {
  unique: true,
})
@Index('IDX_sc_commercial_quotes_valid_until', ['validUntil'])
export class CommercialQuoteEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, update: false })
  sourceCost!: number;

  @Column({ type: 'char', length: 3, update: false })
  currency!: string;

  @Column({ type: 'jsonb', update: false })
  inputs!: Record<string, unknown>;

  @Column({ type: 'jsonb', update: false })
  terms!: Record<string, unknown>;

  @Column({ type: 'jsonb', update: false })
  pricingSnapshot!: Record<string, unknown>;

  @Column({ type: 'timestamptz', update: false })
  issuedAt!: Date;

  @Column({ type: 'timestamptz', update: false })
  validUntil!: Date;

  @Column({ type: 'varchar', length: 64, update: false })
  version!: string;

  @Column({ type: 'varchar', length: 16, default: 'issued' })
  state!: string;

  @Column({ type: 'varchar', length: 128, update: false })
  idempotencyKey!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
