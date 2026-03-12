import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ClassifiedAdStatus = 'active' | 'sold' | 'expired' | 'removed';

@Entity('classified_ad')
export class ClassifiedAdEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  price!: number;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  currency!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  condition!: string | null;

  @Column({ type: 'simple-array', nullable: true })
  imageUrls!: string[] | null;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status!: ClassifiedAdStatus;

  @Column({ type: 'uuid' })
  communityId!: string;

  @Column({ type: 'uuid' })
  profileId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 100, default: 'local-hub' })
  appScope!: string;

  @Column({ type: 'boolean', default: false })
  isFeatured!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  featuredUntil!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;
}
