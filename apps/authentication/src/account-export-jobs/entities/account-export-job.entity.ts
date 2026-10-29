import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AccountExportJobState =
  | 'queued'
  | 'incomplete'
  | 'running'
  | 'failed'
  | 'complete';

@Entity('account_export_jobs')
@Index(
  'uq_account_export_job_idempotency',
  ['accountId', 'appId', 'kind', 'idempotencyKey'],
  { unique: true }
)
@Index('ix_account_export_job_active', ['accountId', 'appId', 'kind', 'state'])
export class AccountExportJobEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') accountId!: string;
  @Column('varchar', { length: 120 }) appId!: string;
  @Column('varchar', { length: 16, default: 'export' }) kind!: 'export';
  @Column('uuid') idempotencyKey!: string;
  @Column('varchar', { length: 24, default: 'incomplete' })
  state!: AccountExportJobState;
  @Column('varchar', { length: 48, default: '2026-10-17.v1' })
  coverageVersion!: string;
  @Column('integer', { default: 0 }) attempt!: number;
  @Column('varchar', { length: 36, nullable: true }) leaseOwner!: string | null;
  @Column('timestamptz', { nullable: true }) leaseExpiresAt!: Date | null;
  @Column('jsonb', { default: () => "'{}'::jsonb" }) coverageSummary!: Record<
    string,
    unknown
  >;
  @Column('varchar', { length: 100, nullable: true }) lastErrorCode!:
    | string
    | null;
  @Column('timestamptz', { nullable: true }) completedAt!: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}
