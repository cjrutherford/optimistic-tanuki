import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export enum EventPrivacy {
  PUBLIC = 'public',
  PRIVATE = 'private',
  COMMUNITY = 'community',
}

@Entity()
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text', { nullable: true })
  description: string;

  @Column()
  startDate: Date;

  @Column({ nullable: true })
  endDate: Date;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  locationUrl: string;

  @Column({
    type: 'enum',
    enum: EventPrivacy,
    default: EventPrivacy.PUBLIC,
  })
  privacy: EventPrivacy;

  @Column({ nullable: true })
  communityId: string;

  @Column()
  profileId: string;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: EventStatus,
    default: EventStatus.DRAFT,
  })
  status: EventStatus;

  @Column({ default: 0 })
  attendeeCount: number;

  @Column('simple-array', { nullable: true })
  attendeeIds: string[];

  @Column({ nullable: true })
  coverImageUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
