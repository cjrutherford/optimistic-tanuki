import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * A learner's claim on an offering, keyed to their learning-scoped profile.
 *
 * This is the record that makes "someone is taking this course" a fact
 * instead of an inference from lesson_progress rows. Lesson progress requires
 * one of these to exist before it can be written.
 */
@Entity('lp_enrolment')
@Index(['profileId', 'offeringId'], { unique: true })
export class EnrolmentEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) profileId!: string;
  @Column({ type: 'varchar', length: 128 }) offeringId!: string;
  @Column({ type: 'varchar', length: 16, default: 'active' }) status!: string;
  @CreateDateColumn() enrolledAt!: Date;
  @Column({ type: 'timestamp', nullable: true }) withdrawnAt!: Date | null;
}
