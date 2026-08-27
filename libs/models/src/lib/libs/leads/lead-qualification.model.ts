import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';
import { Lead } from './lead.model';
import { LeadTopic } from './lead-topic.model';

export type LeadQualificationStageStatus =
  | 'passed'
  | 'warning'
  | 'failed'
  | 'unavailable';

export type LeadQualificationClassification =
  | 'strong-match'
  | 'review'
  | 'weak-match';

@Entity('lead_qualifications')
export class LeadQualification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  leadId: string;

  @Column({ nullable: true })
  topicId: string | null;

  @Column({ type: 'int', nullable: true })
  relevanceScore: number | null;

  @Column({ type: 'text', default: 'unavailable' })
  relevanceStatus: LeadQualificationStageStatus;

  @Column({ type: 'text', array: true, default: '{}' })
  relevanceReasons: string[];

  @Column({ type: 'int', nullable: true })
  difficultyScore: number | null;

  @Column({ type: 'text', default: 'unavailable' })
  difficultyStatus: LeadQualificationStageStatus;

  @Column({ type: 'text', array: true, default: '{}' })
  difficultyReasons: string[];

  @Column({ type: 'int', nullable: true })
  userFitScore: number | null;

  @Column({ type: 'text', default: 'unavailable' })
  userFitStatus: LeadQualificationStageStatus;

  @Column({ type: 'text', array: true, default: '{}' })
  userFitReasons: string[];

  @Column({ type: 'int', nullable: true })
  finalScore: number | null;

  @Column({ type: 'text', default: 'review' })
  classification: LeadQualificationClassification;

  @Column({ type: 'text', default: '2.0' })
  pipelineVersion: string;

  @Column({ type: 'timestamp' })
  analyzedAt: Date;

  // A qualification is derived data about a lead and has no meaning without it.
  // The database has always had ON DELETE CASCADE here; the entity omitted
  // `onDelete`, so TypeORM assumed NO ACTION and every generated migration tried
  // to "correct" the database to match — which would have made a qualified lead
  // undeletable (its delete would fail on the foreign key).
  @OneToOne(() => Lead, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'leadId' })
  lead?: Relation<Lead>;

  @ManyToOne(() => LeadTopic, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'topicId' })
  topic?: Relation<LeadTopic | null>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
