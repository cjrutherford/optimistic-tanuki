import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AudioProjectEntity } from './audio-project.entity';

@Entity('arrangement_sections')
export class ArrangementSectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @ManyToOne(() => AudioProjectEntity, (project) => project.arrangement)
  @JoinColumn({ name: 'projectId' })
  project: AudioProjectEntity;

  @Column()
  label: string;

  @Column({ type: 'int' })
  barStart: number;

  @Column({ type: 'int' })
  barLength: number;

  @Column({ type: 'simple-array', default: '' })
  trackOrder: string[];
}
