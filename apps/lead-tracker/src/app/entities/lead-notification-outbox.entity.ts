import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export type LeadNotificationStatus = 'pending' | 'sent' | 'suppressed';
export type LeadNotificationEventType = 'intake' | 'sla_breach';

@Entity('lead_notification_outbox')
@Unique(['leadId', 'recipientEmail', 'eventType'])
@Index(['status', 'nextAttemptAt'])
export class LeadNotificationOutbox {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  leadId: string;

  @Column({ type: 'varchar', length: 254 })
  recipientEmail: string;

  @Column({ type: 'varchar', length: 24 })
  eventType: LeadNotificationEventType;

  @Column({ type: 'varchar', length: 240 })
  subject: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'text' })
  html: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: LeadNotificationStatus;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  nextAttemptAt: Date;

  @Column({ type: 'text', nullable: true })
  lastError?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
