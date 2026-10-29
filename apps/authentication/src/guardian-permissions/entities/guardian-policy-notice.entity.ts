import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type GuardianPolicyNoticeStatus =
  | 'pending'
  | 'sending'
  | 'accepted'
  | 'failed'
  | 'suppressed';

@Entity({ name: 'guardian_policy_notice' })
@Index(
  'UQ_guardian_policy_notice_version_guardian',
  ['policyVersion', 'guardianUserId'],
  {
    unique: true,
  }
)
@Index('IDX_guardian_policy_notice_delivery', ['status', 'nextAttemptAt'])
@Index('IDX_guardian_policy_notice_created_at', ['createdAt'])
export class GuardianPolicyNoticeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 128 })
  policyVersion!: string;

  @Column({ type: 'varchar', length: 2048 })
  policyUrl!: string;

  @Column({ type: 'uuid' })
  guardianUserId!: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: GuardianPolicyNoticeStatus;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ type: 'timestamptz' })
  nextAttemptAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  leaseUntil!: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  lastFailureCode!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  /** Time the configured provider accepted the message; not proof of inbox delivery. */
  acceptedAt!: Date | null;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}
