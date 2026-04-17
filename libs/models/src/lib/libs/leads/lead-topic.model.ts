import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';
import { LeadTopicLink } from './lead-topic-link.model';
import { LeadDiscoverySource } from './lead-discovery-source.enum';
import { LeadTopicDiscoveryIntent } from './lead-topic-discovery-intent.enum';
import { LeadQualificationSummary } from './lead-stats.interface';

@Entity('lead_topics')
export class LeadTopic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'text', array: true, default: '{}' })
  keywords: string[];

  @Column({ type: 'text', array: true, default: '{}' })
  excludedTerms: string[];

  @Column({ type: 'text', default: LeadTopicDiscoveryIntent.JOB_OPENINGS })
  discoveryIntent: LeadTopicDiscoveryIntent;

  @Column({ type: 'text', array: true, default: '{}' })
  sources: LeadDiscoverySource[];

  @Column({ type: 'text', array: true, nullable: true })
  googleMapsCities?: string[] | null;

  @Column({ type: 'text', array: true, nullable: true })
  googleMapsTypes?: string[] | null;

  @Column({ type: 'text', nullable: true })
  googleMapsLocation?: string | null;

  @Column({ type: 'int', nullable: true })
  googleMapsRadiusMiles?: number | null;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastRun?: Date;

  @Column({ default: 0 })
  leadCount: number;

  @Column({ type: 'int', nullable: true })
  priority: number | null;

  @Column({ type: 'text', array: true, nullable: true })
  targetCompanies: string[] | null;

  @Column({ type: 'text', nullable: true })
  buyerPersona: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  painPoints: string[] | null;

  @Column({ type: 'text', nullable: true })
  valueProposition: string | null;

  @Column({ type: 'text', nullable: true })
  searchStrategy: 'aggressive' | 'balanced' | 'conservative' | null;

  @Column({ type: 'int', nullable: true })
  confidence: number | null;

  @Column({ type: 'varchar', default: 'leads-app' })
  appScope: string;

  @Column({ type: 'varchar' })
  profileId: string;

  @Column({ type: 'varchar' })
  userId: string;

  @OneToMany(() => LeadTopicLink, (leadLink) => leadLink.topic)
  leadLinks?: Relation<LeadTopicLink[]>;

  qualificationSummary?: LeadQualificationSummary;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
