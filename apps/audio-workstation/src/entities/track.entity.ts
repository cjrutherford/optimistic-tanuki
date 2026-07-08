import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AudioProjectEntity } from './audio-project.entity';

export type TrackType =
  | 'vocal'
  | 'drum'
  | 'bass'
  | 'guitar'
  | 'synth'
  | 'pad'
  | 'fx'
  | 'other';

@Entity('tracks')
export class TrackEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @ManyToOne(() => AudioProjectEntity, (project) => project.tracks)
  @JoinColumn({ name: 'projectId' })
  project: AudioProjectEntity;

  @Column()
  name: string;

  @Column({ type: 'varchar', length: 20 })
  type: TrackType;

  @Column({ nullable: true })
  assetId: string;

  @Column({ type: 'float', default: 0 })
  volume: number;

  @Column({ type: 'float', default: 0 })
  pan: number;

  @Column({ default: false })
  muted: boolean;

  @Column({ default: false })
  solo: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'float', default: 0 })
  startOffset: number;

  @Column({ nullable: true })
  waveformDataUrl: string;
}
