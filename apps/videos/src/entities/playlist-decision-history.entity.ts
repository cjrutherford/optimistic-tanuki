import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
@Index(['feedId', 'createdAt'])
export class PlaylistDecisionHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  feedId: string;

  @Column({ type: 'varchar', length: 20 })
  kind: 'live' | 'scheduled' | 'rerun' | 'ad' | 'filler' | 'offline';

  @Column({ type: 'varchar', length: 120 })
  reason: string;

  @Column({ type: 'uuid', nullable: true })
  sessionId: string | null;

  @Column({ type: 'uuid', nullable: true })
  blockId: string | null;

  @Column({ type: 'uuid', nullable: true })
  videoId: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  placementType: 'pre-roll' | 'mid-roll' | 'post-roll' | null;

  @Column({ type: 'text', nullable: true })
  mediaUrl: string | null;

  @Column({ type: 'timestamp' })
  decidedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
