import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AudioProjectEntity } from './audio-project.entity';

export interface EqSettings {
  lowGain?: number;
  midGain?: number;
  highGain?: number;
  lowFreq?: number;
  highFreq?: number;
}

export interface DynamicsSettings {
  threshold?: number;
  ratio?: number;
  knee?: number;
  attack?: number;
  release?: number;
}

export interface EffectsSettings {
  reverbMix?: number;
  reverbDecay?: number;
  delayMix?: number;
  delayTime?: number;
  delayFeedback?: number;
}

@Entity('mix_snapshots')
export class MixSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @ManyToOne(() => AudioProjectEntity, (project) => project.mixSnapshots)
  @JoinColumn({ name: 'projectId' })
  project: AudioProjectEntity;

  @Column()
  trackId: string;

  @Column({ type: 'float' })
  volume: number;

  @Column({ type: 'float' })
  pan: number;

  @Column({ type: 'jsonb', default: {} })
  eq: EqSettings;

  @Column({ type: 'jsonb', default: {} })
  dynamics: DynamicsSettings;

  @Column({ type: 'jsonb', default: {} })
  effects: EffectsSettings;

  @UpdateDateColumn()
  updatedAt: Date;
}
