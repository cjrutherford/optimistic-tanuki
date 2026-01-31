import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Channel } from './channel.entity';

@Entity()
export class ChannelSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Channel, (channel) => channel.subscriptions)
  channel: Channel;

  @Column()
  channelId: string;

  @Column()
  userId: string;

  @Column()
  profileId: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  subscribedAt: Date;
}
