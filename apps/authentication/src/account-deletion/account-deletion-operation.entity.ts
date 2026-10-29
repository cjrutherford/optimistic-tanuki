import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AccountDeletionOperationState =
  | 'fencing'
  | 'deleting'
  | 'blocked'
  | 'complete';

@Entity('account_deletion_operations')
@Index('UQ_account_deletion_operations_fenceKey', ['fenceKey'], {
  unique: true,
})
export class AccountDeletionOperationEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', nullable: true }) accountId!: string | null;
  @Column({ type: 'varchar', length: 64 }) fenceKey!: string;
  @Column({ type: 'varchar' }) appId!: string;
  @Column({ type: 'varchar' }) state!: AccountDeletionOperationState;
  @Column({ type: 'uuid' }) idempotencyKey!: string;
  @Column({ type: 'integer', default: 0 }) attempt!: number;
  @Column({ type: 'uuid', nullable: true }) leaseOwner!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) leaseExpiresAt!: Date | null;
  @Column({ type: 'jsonb', nullable: true }) privateScope!: {
    currentProfileIds: string[];
    legacyProfileIds: string[];
  } | null;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  ownerProgress!: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}
