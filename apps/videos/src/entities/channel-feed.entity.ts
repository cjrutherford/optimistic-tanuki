import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Channel } from './channel.entity';

@Entity()
export class ChannelFeed {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  channelId: string;

  @Column({ unique: true })
  communityId: string;

  @OneToOne(() => Channel, (channel) => channel.feed, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channelId' })
  channel: Channel;

  @Column({ type: 'varchar', length: 100, default: 'UTC' })
  timezone: string;

  @Column({ type: 'varchar', length: 20, default: 'offline' })
  currentMode: 'offline' | 'scheduled' | 'live';

  @Column({ type: 'uuid', nullable: true })
  activeProgramBlockId: string | null;

  @Column({ type: 'uuid', nullable: true })
  activeLiveSessionId: string | null;

  @Column({ type: 'uuid', nullable: true })
  activeVideoId: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastTransitionAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
