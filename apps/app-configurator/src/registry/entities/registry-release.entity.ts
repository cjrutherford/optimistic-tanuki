import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('registry_release')
@Index(['version'], { unique: true })
export class RegistryReleaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'int' })
  version!: number;

  @Column({ type: 'varchar', length: 16, default: 'published' })
  status!: 'draft' | 'published';

  /** The live release. Exactly one published row is current. */
  @Column({ type: 'boolean', default: false })
  isCurrent!: boolean;

  /** `{ registry, links }` exactly as served. */
  @Column({ type: 'jsonb' })
  snapshot!: Record<string, unknown>;

  @Column({ type: 'text', default: '' })
  releaseNotes!: string;

  @Column({ type: 'text', nullable: true })
  changeSummary!: string | null;

  /** Hash of the deployed YAML as it was when this release went out. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  sourceHash!: string | null;

  /** Set when this release restores an earlier one. */
  @Column({ type: 'int', nullable: true })
  restoredFromVersion!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  publishedBy!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
