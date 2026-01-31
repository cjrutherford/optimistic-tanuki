import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Video } from './video.entity';
import { ChannelSubscription } from './channel-subscription.entity';

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

  @Column({ nullable: true })
  bannerAssetId: string;

  @Column({ nullable: true })
  avatarAssetId: string;

  @OneToMany(() => Video, (video) => video.channel)
  videos: Video[];

  @OneToMany(() => ChannelSubscription, (subscription) => subscription.channel)
  subscriptions: ChannelSubscription[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
