import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('lp_lesson_progress')
export class LessonProgressEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) userId!: string;
  /**
   * The learning-scoped profile this progress belongs to.
   *
   * Nullable because rows written before profiles and enrolments existed in
   * this app cannot be safely attributed to one after the fact; they stay in
   * the table as an orphaned historical record rather than being deleted or
   * guessed at. Every row written going forward has this set, and a row must
   * also have a matching enrolment before it can be created.
   */
  @Column({ type: 'uuid', nullable: true }) profileId!: string | null;
  @Column({ type: 'uuid', nullable: true }) enrolmentId!: string | null;
  @Column({ type: 'varchar', length: 192 }) lessonId!: string;
  @Column({ type: 'boolean', default: false }) completed!: boolean;
  @Column({ type: 'jsonb', default: () => "'[]'" })
  completedExerciseIds!: string[];
  @Column({ type: 'integer', default: 0 }) points!: number;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
