import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Relation,
} from 'typeorm';
import { Lead } from './lead.model';
import { LeadFlagReason } from './lead-flag-reason.enum';

@Entity('lead_flags')
export class LeadFlag {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    leadId: string;

    @ManyToOne(() => Lead, (lead) => lead.flags, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'leadId' })
    lead?: Relation<Lead>;

    @Column({ type: 'enum', enum: LeadFlagReason, array: true })
    reasons: LeadFlagReason[];

    @Column({ type: 'text', nullable: true })
    notes?: string;

    @Column({ type: 'varchar' })
    profileId: string;

    @Column({ type: 'varchar' })
    userId: string;

    @CreateDateColumn()
    createdAt: Date;
}
