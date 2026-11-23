import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('registry_audit')
@Index(['createdAt'])
export class RegistryAuditEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'varchar', length: 32 })
  action!: string;

  @Column({ type: 'varchar', length: 256 })
  actor!: string;

  @Column({ type: 'text' })
  summary!: string;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'int', nullable: true })
  releaseVersion!: number | null;

  @Column({ type: 'jsonb', nullable: true })
  before!: unknown | null;

  @Column({ type: 'jsonb', nullable: true })
  after!: unknown | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, string | number | boolean>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
