import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Video } from './video.entity';

@Entity()
export class VideoView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Video, (video) => video.views)
  video: Video;

  @Column()
  videoId: string;

  @Column({ nullable: true })
  userId: string;

  @Column({ nullable: true })
  profileId: string;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ type: 'int', nullable: true })
  watchDurationSeconds: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  viewedAt: Date;
}
