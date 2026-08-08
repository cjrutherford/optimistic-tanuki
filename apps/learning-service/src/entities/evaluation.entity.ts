import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('lp_evaluation')
export class EvaluationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  attemptId!: string;

  @Column({ type: 'varchar', length: 16 })
  mode!: string;

  @Column({ type: 'varchar', length: 16 })
  grader!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  score!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  maxScore!: number;

  @Column({ type: 'text' })
  feedback!: string;

  @Column({ type: 'jsonb', nullable: true })
  rubric!: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: false })
  humanOverride!: boolean;

  @CreateDateColumn()
  evaluatedAt!: Date;
}
