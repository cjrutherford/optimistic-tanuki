import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sc_hardware_parts')
export class HardwarePartEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 16 })
  category!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  vendor!: string | null;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  basePrice!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  sellingPrice!: number;

  @Column({ type: 'jsonb', default: {} })
  specs!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: [] })
  compatibleChassisSlugs!: string[];

  @Column({ type: 'boolean', default: true })
  inStock!: boolean;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 32, default: 'curated' })
  sourceType!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  externalSource!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalId!: string | null;

  @Column({ type: 'text', nullable: true })
  sourceUrl!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt!: Date | null;

  @Column({ type: 'varchar', length: 16, default: 'seeded' })
  syncStatus!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
