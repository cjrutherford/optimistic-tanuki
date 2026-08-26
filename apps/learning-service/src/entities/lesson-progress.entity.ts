import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EnrolmentEntity } from './enrolment.entity';

@Entity('lp_lesson_progress')
/**
 * One row per learner per lesson, and the database enforces it.
 *
 * This is not bookkeeping: recordSolvedExercise merges awards with
 * `INSERT ... ON CONFLICT ("profileId", "lessonId")`, and Postgres resolves
 * that target against a unique index on exactly those columns. Without this
 * the merge has nothing to conflict on, and two exercises finishing together
 * insert two rows instead of combining.
 */
@Index(['profileId', 'lessonId'], { unique: true })
@Index(['userId'])
@Index(['profileId'])
export class LessonProgressEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) userId!: string;
  /**
   * The learner this belongs to, and the enrolment that entitles them to it.
   *
   * Both are required. A migration deletes the rows that predate enrolment
   * rather than backfilling them, because the profiles live in another
   * service and inventing enrolments would fabricate a record of people
   * taking courses they never took.
   */
  @Column({ type: 'uuid' }) profileId!: string;
  @Column({ type: 'uuid' }) enrolmentId!: string;
  /**
   * The enrolment that entitles this progress to exist.
   *
   * Declared as a relation rather than a bare column so the foreign key is
   * part of the schema the entities describe. Progress without an enrolment
   * is progress nobody is entitled to, and the database should be the thing
   * that says so.
   */
  @ManyToOne(() => EnrolmentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'enrolmentId' })
  enrolment?: EnrolmentEntity;
  @Column({ type: 'varchar', length: 192 }) lessonId!: string;
  @Column({ type: 'boolean', default: false }) completed!: boolean;
  @Column({ type: 'jsonb', default: () => "'[]'" })
  completedExerciseIds!: string[];
  @Column({ type: 'integer', default: 0 }) points!: number;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
