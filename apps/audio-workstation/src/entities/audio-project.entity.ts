import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { TrackEntity } from './track.entity';
import { ArrangementSectionEntity } from './arrangement-section.entity';
import { MixSnapshotEntity } from './mix-snapshot.entity';
import { AIGenerationRequestEntity } from './ai-generation-request.entity';

@Entity('audio_projects')
export class AudioProjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  name: string;

  @Column({ type: 'int', default: 120 })
  bpm: number;

  @Column({ default: 'C' })
  key: string;

  @Column({ default: '4/4' })
  timeSignature: string;

  @Column({ nullable: true })
  genre: string;

  @Column({ nullable: true })
  mood: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => TrackEntity, (track) => track.project, { cascade: true })
  tracks: TrackEntity[];

  @OneToMany(() => ArrangementSectionEntity, (section) => section.project, {
    cascade: true,
  })
  arrangement: ArrangementSectionEntity[];

  @OneToMany(() => MixSnapshotEntity, (mix) => mix.project, { cascade: true })
  mixSnapshots: MixSnapshotEntity[];

  @OneToMany(() => AIGenerationRequestEntity, (req) => req.project, {
    cascade: true,
  })
  generationRequests: AIGenerationRequestEntity[];
}
