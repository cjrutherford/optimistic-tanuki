import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  OutreachDraft,
  OutreachEvidenceReport,
} from './lead-outreach.interface';

/**
 * A generated first-contact message for one lead.
 *
 * Rows are never updated in place — each regeneration inserts a new version, so
 * a user who preferred an earlier draft can still get it back. The evidence
 * report is stored alongside because what the generator *removed* is as
 * important to keep as what it produced.
 */
@Entity('lead_outreach_drafts')
// Unique for the same reason the application version is: the next version is
// read and then written, and generation runs a model call, which holds that
// window open long enough for a double-click to land inside it.
@Index(['profileId', 'leadId', 'version'], { unique: true })
export class LeadOutreachDraftRecord {
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
  draft: OutreachDraft;

  @Column({ type: 'jsonb' })
  evidence: OutreachEvidenceReport;

  /** False when no model was reachable and the deterministic path produced it. */
  @Column({ type: 'boolean', default: false })
  modelGenerated: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
