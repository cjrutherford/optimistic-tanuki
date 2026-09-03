import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class AiChange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @Column()
  proposedBy: string;

  @Column()
  operation: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  /** Why it was proposed. A reviewer needs the argument, not just the change. */
  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ default: 'PENDING' })
  status: 'PENDING' | 'APPROVED' | 'REJECTED';

  @Column({ nullable: true })
  reviewedBy?: string;

  @Column({ type: 'text', nullable: true })
  reviewNote?: string;

  /**
   * What happened when the approval was carried out.
   *
   * Approving used to be the end of the story, so there was nothing to record.
   * Now that an approved change is applied, an apply that fails has to be
   * visible: otherwise a reviewer sees APPROVED and reasonably believes the
   * board changed, when it did not.
   */
  @Column({ default: false })
  applied: boolean;

  /** The row this change created or altered, when it created one. */
  @Column({ nullable: true })
  appliedEntityId?: string;

  @Column({ type: 'text', nullable: true })
  applyError?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
