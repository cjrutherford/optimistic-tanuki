import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Persists the full ProgramTrack definition as JSONB.
 * The rich nested shape (offerings, requirement graph, modules, activities)
 * lives in the domain library; the DB row keeps it serialised for quick
 * listing and future query indexing.
 */
@Entity('lp_program_track')
export class ProgramTrackEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** The logical identifier shared with the domain model (e.g. 'systems-foundations'). */
  @Column({ type: 'varchar', length: 128, unique: true })
  trackId!: string;

  @Column({ type: 'varchar', length: 256 })
  displayName!: string;

  /** Full serialised ProgramTrack value object stored as JSONB. */
  @Column({ type: 'jsonb' })
  data!: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
