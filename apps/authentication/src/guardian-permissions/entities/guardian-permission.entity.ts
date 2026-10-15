import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type GuardianPermissionStatus =
  | 'pending'
  | 'approved'
  | 'revoked'
  | 'expired'
  | 'adult-challenge';

@Entity({ name: 'guardian_permission' })
@Index('IDX_guardian_permission_user_id', ['userId'], { unique: true })
export class GuardianPermissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 320 })
  applicantEmail!: string;

  @Column({ type: 'varchar', length: 320, nullable: true })
  guardianEmail!: string | null;

  @Column({ type: 'date', nullable: true })
  dateOfBirth!: string | null;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  guardianUserId!: string | null;

  @Column({ type: 'varchar', length: 32 })
  status!: GuardianPermissionStatus;

  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  guardianTokenHash!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  resumeTokenHash!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  withdrawalTokenHash!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  attestationVersion!: string | null;

  @Column({ type: 'text', nullable: true })
  attestationText!: string | null;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  attestedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deleteAfter!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  resumeExpiresAt!: Date | null;

  @Column({ type: 'varchar', length: 64 })
  appId!: string;

  @Column({ type: 'varchar', length: 256 })
  appName!: string;

  @Column({ type: 'varchar', length: 512 })
  uiBaseUrl!: string;

  @Column({ type: 'varchar', length: 320 })
  emailFrom!: string;

  @Column({ type: 'varchar', length: 320, nullable: true })
  replyTo!: string | null;
}
