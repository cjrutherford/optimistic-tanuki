import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LeadSource } from './lead-source.enum';
import { LeadStatus } from './lead-status.enum';

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export interface LeadStats {
  total: number;
  autoDiscovered: number;
  manual: number;
  totalValue: number;
  followUpsDue: number;
  byStatus: Record<string, number>;
}
