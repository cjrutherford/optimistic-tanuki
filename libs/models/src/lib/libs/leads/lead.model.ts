import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Relation,
} from 'typeorm';
import { LeadSource } from './lead-source.enum';
import { LeadStatus } from './lead-status.enum';
import { LeadFlag } from './lead-flag.model';
import { LeadTopicLink } from './lead-topic-link.model';
import { LeadContactPoint } from './lead-contact-point.interface';
import { PresenceGap } from './lead-presence-gap.interface';

@Entity('leads')
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  company?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  originalPostingUrl?: string;

  /**
   * The business's own site, where that is a different thing from the URL the
   * lead was found at. A funding lead's posting URL is the news article, so
   * without this every use of it points at the publication rather than the
   * company. Null when none could be established.
   */
  @Column({ nullable: true })
  companyWebsite?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  contacts?: LeadContactPoint[];

  @Column({ type: 'enum', enum: LeadSource })
  source: LeadSource;

  @Column({ type: 'enum', enum: LeadStatus, default: LeadStatus.NEW })
  status: LeadStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  value: number;

  @Column({ type: 'text', default: '' })
  notes: string;

  @Column({ type: 'date', nullable: true })
  nextFollowUp?: string;

  @Column({ default: false })
  isAutoDiscovered: boolean;

  @Column({ type: 'simple-array', nullable: true })
  searchKeywords?: string[];

  /**
   * Why this business is worth contacting, for the local-business sources.
   * Null on every other source — a job posting has no online presence to be
   * missing. Stored rather than recomputed because the source that observed
   * the gap is not queried again when the lead is read.
   */
  @Column({ type: 'jsonb', nullable: true })
  presenceGaps?: PresenceGap[] | null;

  /** The summed weight of `presenceGaps`, capped at 100. */
  @Column({ type: 'int', nullable: true })
  presenceGapScore?: number | null;

  @Column({ nullable: true })
  assignedTo?: string;

  @Column({ nullable: true })
  contactSubject?: string;

  @Column({ type: 'text', nullable: true })
  contactMessage?: string;

  @Column({ nullable: true })
  contactSourceLabel?: string;

  @Column({ type: 'varchar', default: 'leads-app' })
  appScope: string;

  @Column({ type: 'varchar' })
  profileId: string;

  @Column({ type: 'varchar' })
  userId: string;

  @OneToMany(() => LeadFlag, (flag) => flag.lead)
  flags?: Relation<LeadFlag[]>;

  @OneToMany(() => LeadTopicLink, (topicLink) => topicLink.lead)
  topicLinks?: Relation<LeadTopicLink[]>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastRespondedAt?: Date;
}
