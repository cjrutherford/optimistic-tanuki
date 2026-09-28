import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type OtpChallengeStateType = 'session' | 'totp_replay' | 'totp_failure';

@Entity('otp_challenges')
@Index(
  'UQ_otp_challenges_tenant_token_purpose_state',
  ['tenantId', 'tokenId', 'purpose', 'stateType'],
  { unique: true }
)
@Index('IDX_otp_challenges_tenant_expires', ['tenantId', 'expiresAt'])
export class OtpChallengeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128 })
  tenantId: string;

  @Column({ type: 'varchar', length: 512 })
  tokenId: string;

  @Column({ type: 'varchar', length: 128 })
  purpose: string;

  @Column({ type: 'varchar', length: 32, default: 'session' })
  stateType: OtpChallengeStateType;

  @Column({ type: 'varchar', length: 128, nullable: true })
  codeHash: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  codeSalt: string | null;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'integer', default: 0 })
  attemptCount: number;

  @Column({ type: 'timestamp', nullable: true })
  consumedAt: Date | null;

  @Column({ type: 'bigint', nullable: true })
  lastAcceptedCounter: number | null;

  @Column({ type: 'integer', nullable: true })
  windowSeconds: number | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
