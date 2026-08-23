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
   * The learner this belongs to, and the enrolment that entitles them to it.
   *
   * Both are required. A migration deletes the rows that predate enrolment
   * rather than backfilling them, because the profiles live in another
   * service and inventing enrolments would fabricate a record of people
   * taking courses they never took.
   */
  @Column({ type: 'uuid' }) profileId!: string;
  @Column({ type: 'uuid' }) enrolmentId!: string;
  @Column({ type: 'varchar', length: 192 }) lessonId!: string;
  @Column({ type: 'boolean', default: false }) completed!: boolean;
  @Column({ type: 'jsonb', default: () => "'[]'" })
  completedExerciseIds!: string[];
  @Column({ type: 'integer', default: 0 }) points!: number;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
