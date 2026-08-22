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
  @Column({ type: 'varchar', length: 192 }) lessonId!: string;
  @Column({ type: 'boolean', default: false }) completed!: boolean;
  @Column({ type: 'jsonb', default: () => "'[]'" })
  completedExerciseIds!: string[];
  @Column({ type: 'integer', default: 0 }) points!: number;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
