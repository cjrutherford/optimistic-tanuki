import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { AudioProjectEntity } from './audio-project.entity';

export type AgentType = 'compose' | 'stem' | 'mix' | 'master';
export type GenerationStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';
export type CollaborationMode = 'full-auto' | 'cover' | 'full-collab';

@Entity('ai_generation_requests')
export class AIGenerationRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @ManyToOne(() => AudioProjectEntity, (project) => project.generationRequests)
  @JoinColumn({ name: 'projectId' })
  project: AudioProjectEntity;

  @Column()
  userId: string;

  @Column({ type: 'varchar', length: 20, default: 'full-auto' })
  collaborationMode: CollaborationMode;

  @Column({ type: 'varchar', length: 20 })
  agentType: AgentType;

  @Column({ type: 'text' })
  prompt: string;

  @Column({ type: 'jsonb', default: {} })
  parameters: Record<string, unknown>;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: GenerationStatus;

  @Column({ nullable: true })
  resultAssetId: string;

  @Column({ nullable: true })
  voiceMemoAssetId: string;

  @Column({ nullable: true })
  referenceTrackAssetId: string;

  @Column({ nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  completedAt: Date;
}
