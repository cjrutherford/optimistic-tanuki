import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Channel } from './channel.entity';
import { VideoView } from './video-view.entity';

@Entity()
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  assetId: string;

  @Column({ nullable: true })
  thumbnailAssetId: string;

  @ManyToOne(() => Channel, (channel) => channel.videos)
  channel: Channel;

  @Column()
  channelId: string;

  @Column({ type: 'int', nullable: true })
  durationSeconds: number;

  @Column({ nullable: true })
  resolution: string;

  @Column({ nullable: true })
  encoding: string;

  @OneToMany(() => VideoView, (view) => view.video)
  views: VideoView[];

  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @Column({ type: 'int', default: 0 })
  likeCount: number;

  @Column({ type: 'varchar', default: 'public' })
  visibility: 'public' | 'unlisted' | 'private';

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date;
}
