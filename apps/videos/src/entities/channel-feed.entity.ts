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
  currentMode: 'offline' | 'scheduled' | 'live' | 'replay';

  @Column({ type: 'uuid', nullable: true })
  activeProgramBlockId: string | null;

  @Column({ type: 'uuid', nullable: true })
  activeLiveSessionId: string | null;

  @Column({ type: 'uuid', nullable: true })
  activeVideoId: string | null;

  @Column({ type: 'varchar', length: 20, default: 'offline' })
  activePlaylistKind:
    | 'live'
    | 'scheduled'
    | 'rerun'
    | 'ad'
    | 'filler'
    | 'offline';

  @Column({
    type: 'varchar',
    length: 120,
    default: 'no-playable-source-available',
  })
  activePlaylistReason: string;

  @Column({ type: 'uuid', nullable: true })
  activePlaylistSessionId: string | null;

  @Column({ type: 'uuid', nullable: true })
  activePlaylistBlockId: string | null;

  @Column({ type: 'uuid', nullable: true })
  activePlaylistVideoId: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  activePlaylistPlacementType: 'pre-roll' | 'mid-roll' | 'post-roll' | null;

  @Column({ type: 'text', nullable: true })
  activePlaylistMediaUrl: string | null;

  @Column({ type: 'timestamp', nullable: true })
  activePlaylistDecidedAt: Date | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastTransitionAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
