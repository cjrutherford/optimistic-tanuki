import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('lp_attempt')
export class AttemptEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 128 })
  offeringId!: string;

  @Column({ type: 'varchar', length: 128 })
  activityId!: string;

  @Column({ type: 'varchar', length: 32 })
  activityType!: string;

  @Column({ type: 'varchar', length: 32, default: 'submitted' })
  state!: string;

  @Column({ type: 'boolean', default: false })
  isAsync!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  submission!: Record<string, unknown> | null;

  @CreateDateColumn()
  submittedAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
