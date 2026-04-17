import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Relation,
    UpdateDateColumn,
} from 'typeorm';
import { Lead } from './lead.model';
import { LeadTopic } from './lead-topic.model';

export type LeadTopicLinkType = 'auto' | 'manual';

@Entity('lead_topic_links')
@Index(['leadId', 'topicId'], { unique: true })
export class LeadTopicLink {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid')
    leadId: string;

    @Column('uuid')
    topicId: string;

    @Column({ default: 'auto' })
    linkType: LeadTopicLinkType;

    @Column({ default: 'internal' })
    sourceProvider: string;

    @Column({ type: 'text', array: true, default: '{}' })
    matchedKeywords: string[];

    @ManyToOne(() => Lead, (lead) => lead.topicLinks, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'leadId' })
    lead: Relation<Lead>;

    @ManyToOne(() => LeadTopic, (topic) => topic.leadLinks, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'topicId' })
    topic: Relation<LeadTopic>;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
