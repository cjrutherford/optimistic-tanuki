import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum ReportReason {
  SPAM = 'spam',
  HARASSMENT = 'harassment',
  HATE_SPEECH = 'hate_speech',
  VIOLENCE = 'violence',
  MISINFORMATION = 'misinformation',
  INAPPROPRIATE = 'inappropriate',
  OTHER = 'other',
}

@Entity()
export class ContentReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  reporterId: string;

  @Column()
  contentType: 'post' | 'comment' | 'profile' | 'community' | 'message';

  @Column()
  contentId: string;

  @Column({ type: 'enum', enum: ReportReason })
  reason: ReportReason;

  @Column({ nullable: true })
  description: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';

  @Column({ nullable: true })
  adminNotes: string;

  @CreateDateColumn()
  createdAt: Date;
}
