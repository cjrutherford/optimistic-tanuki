import {
  Column,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Video } from './video.entity';
import { ChannelSubscription } from './channel-subscription.entity';
import { ChannelFeed } from './channel-feed.entity';

@Entity()
export class Channel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  profileId: string;

  @Column()
  userId: string;

  @Column({ unique: true })
  communityId: string;

  @Column({ nullable: true, unique: true })
  communitySlug: string;

  @Column({ type: 'varchar', default: 'public' })
  joinPolicy: string;

  @Column({ type: 'varchar', default: 'video-client' })
  appScope: string;

  @Column({ type: 'int', default: 0 })
  memberCount: number;

  @Column({ default: true })
  isPublic: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  timezone: string | null;

  @Column({ nullable: true })
  bannerAssetId: string;

  @Column({ nullable: true })
  avatarAssetId: string;

  @OneToMany(() => Video, (video) => video.channel)
  videos: Video[];

  @OneToMany(() => ChannelSubscription, (subscription) => subscription.channel)
  subscriptions: ChannelSubscription[];

  @OneToOne(() => ChannelFeed, (feed) => feed.channel, { nullable: true })
  feed?: ChannelFeed | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
