import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  ApplicationEvidenceReport,
  TailoredCoverLetter,
  TailoredResume,
} from './lead-application.interface';

/**
 * A generated resume + cover letter pair for one lead.
 *
 * Rows are never updated in place — each regeneration inserts a new version, so
 * a user who preferred an earlier draft can still get it back. The evidence
 * report is stored alongside because what the generator *removed* is as
 * important to keep as what it produced.
 */
@Entity('lead_applications')
@Index(['profileId', 'leadId', 'version'])
export class LeadApplicationRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  leadId: string;

  @Column({ type: 'varchar' })
  profileId: string;

  @Column({ type: 'varchar', nullable: true })
  userId: string | null;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'jsonb' })
  resume: TailoredResume;

  @Column({ type: 'jsonb' })
  coverLetter: TailoredCoverLetter;

  @Column({ type: 'jsonb' })
  evidence: ApplicationEvidenceReport;

  /** False when no model was reachable and the deterministic path produced it. */
  @Column({ type: 'boolean', default: false })
  modelGenerated: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
