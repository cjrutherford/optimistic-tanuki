import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class ProgramBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  communityId: string;

  @Column({ type: 'uuid' })
  channelId: string;

  @Column({ type: 'uuid', nullable: true })
  videoId: string | null;

  @Column({ type: 'varchar', length: 20, default: 'prerecorded' })
  blockType: 'prerecorded' | 'live_window';

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 20, default: 'scheduled' })
  status: 'scheduled' | 'live' | 'completed' | 'interrupted' | 'cancelled';

  @Column({ type: 'timestamp' })
  startsAt: Date;

  @Column({ type: 'timestamp' })
  endsAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  actualStartAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  actualEndAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
