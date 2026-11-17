import { Check, Column, Entity, PrimaryColumn } from 'typeorm';

/** Local source authority. Its value alone cannot detect a restored database. */
@Entity({ name: 'community_directory_epoch' })
@Check('"id" = 1')
export class CommunityDirectoryEpoch {
  @PrimaryColumn({ type: 'integer' }) id!: number;
  @Column({ type: 'uuid' }) sourceEpoch!: string;
  @Column({ type: 'uuid', nullable: true }) registerBaselineEpoch!:
    | string
    | null;
  @Column({ type: 'uuid', nullable: true }) directoryRecoveryEpoch!:
    | string
    | null;
  @Column({ type: 'boolean', default: true }) fenced!: boolean;
  @Column({ type: 'uuid', nullable: true }) activationId!: string | null;
  @Column({ type: 'uuid', nullable: true }) owner!: string | null;
  @Column({ type: 'bigint', default: 0 }) socialGeneration!: string;
  @Column({ type: 'bigint', nullable: true }) directoryGeneration!:
    | string
    | null;
  @Column({ type: 'varchar', default: 'fenced' }) phase!: string;
  @Column({ type: 'jsonb', nullable: true }) preparedPayload!: Record<
    string,
    string
  > | null;
  @Column({ type: 'timestamptz' }) initializedAt!: Date;
  @Column({ type: 'timestamptz' }) updatedAt!: Date;
}
