import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum PresenceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  AWAY = 'away',
  BUSY = 'busy',
}

@Entity()
@Index(['userId'], { unique: true })
export class UserPresence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;

  @Column({
    type: 'enum',
    enum: PresenceStatus,
    default: PresenceStatus.OFFLINE,
  })
  status: PresenceStatus;

  @Column({ nullable: true })
  lastSeen: Date;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ default: false })
  isExplicit: boolean;
}
