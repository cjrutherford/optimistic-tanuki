import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sc_case_options')
export class CaseOptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  chassisSlug!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 32 })
  optionType!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  vendor!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sourceName!: string | null;

  @Column({ type: 'text', nullable: true })
  sourceUrl!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  priceMin!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  priceMax!: number | null;

  @Column({ type: 'text', nullable: true })
  priceLabel!: string | null;

  @Column({ type: 'jsonb', default: [] })
  features!: string[];

  @Column({ type: 'boolean', default: false })
  isRecommended!: boolean;

  @Column({ type: 'varchar', length: 32, default: 'curated' })
  sourceType!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  externalSource!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalId!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
