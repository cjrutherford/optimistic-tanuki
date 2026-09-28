import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sc_supplier_offers')
@Check(
  'CHK_sc_supplier_offers_vendor',
  "\"vendor\" IN ('CDW', 'Newegg Business', 'Amazon Business', 'Dell OEM')"
)
@Check(
  'CHK_sc_supplier_offers_availability',
  "\"availability\" IN ('in_stock', 'backorder', 'out_of_stock', 'unknown')"
)
@Check(
  'CHK_sc_supplier_offers_source_channel',
  "\"sourceChannel\" IN ('live-api', 'file-import')"
)
@Index('UQ_sc_supplier_offers_vendor_source_id', ['vendor', 'sourceId'], {
  unique: true,
})
@Index('IDX_sc_supplier_offers_vendor_sku_observed', [
  'vendor',
  'sourceSku',
  'observedAt',
])
export class SupplierOfferEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32 })
  vendor!: string;

  /** File imports are useful for staging, but cannot support a firm quote. */
  @Column({ type: 'varchar', length: 16, default: 'file-import' })
  sourceChannel!: 'live-api' | 'file-import';

  @Column({ type: 'varchar', length: 255 })
  sourceId!: string;

  @Column({ type: 'varchar', length: 255 })
  sourceSku!: string;

  @Column({ type: 'varchar', length: 512 })
  productName!: string;

  @Column({ type: 'text', nullable: true })
  sourceUrl!: string | null;

  @Column({ type: 'uuid', nullable: true })
  hardwarePartId!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: 'char', length: 3 })
  currency!: string;

  @Column({ type: 'varchar', length: 24, default: 'unknown' })
  availability!: string;

  @Column({ type: 'timestamptz' })
  observedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
