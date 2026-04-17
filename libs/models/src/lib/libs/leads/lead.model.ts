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

  @Column({ nullable: true })
  assignedTo?: string;

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
}
