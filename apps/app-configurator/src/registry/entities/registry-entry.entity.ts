import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type RegistryEntryKind = 'app' | 'link' | 'meta';

/**
 * The working (draft) registry: one row per app, per navigation link, plus a
 * single `meta` row for the registry version. Publishing snapshots these rows
 * into `registry_release`.
 */
@Entity('registry_entry')
@Index(['kind', 'key'], { unique: true })
export class RegistryEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 16 })
  kind!: RegistryEntryKind;

  /** appId for apps, linkId for links, `registry` for meta. */
  @Column({ type: 'varchar', length: 256 })
  key!: string;

  @Column({ type: 'jsonb' })
  definition!: Record<string, unknown>;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
