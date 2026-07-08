import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export type ExportFormat = 'wav' | 'mp3' | 'flac';
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';

@Entity('export_jobs')
export class ExportJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @Column()
  userId: string;

  @Column({ type: 'varchar', length: 10 })
  format: ExportFormat;

  @Column({ type: 'varchar', length: 20, default: 'high' })
  quality: string;

  @Column({ type: 'int', nullable: true })
  bitrate: number;

  @Column({ type: 'int', nullable: true })
  bitDepth: number;

  @Column({ type: 'int', nullable: true })
  sampleRate: number;

  @Column({ default: false })
  includeStems: boolean;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: ExportStatus;

  @Column({ nullable: true })
  resultAssetId: string;

  @Column({ nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  completedAt: Date;
}
