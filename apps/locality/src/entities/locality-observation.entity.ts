import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import {
  LocalityAssessmentStatus,
  LocalitySource,
} from '@optimistic-tanuki/models';

@Entity({ name: 'locality_observation' })
@Index(['subjectId', 'source', 'observedAt'])
export class LocalityObservationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  subjectId: string;

  @Column()
  source: LocalitySource;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @Column({ type: 'double precision', nullable: true })
  accuracyMeters?: number;

  @Column({ type: 'timestamptz' })
  observedAt: Date;

  @Column()
  status: LocalityAssessmentStatus;

  @Column({ type: 'integer' })
  confidenceScore: number;

  @Column('text', { array: true })
  reasons: string[];

  @Column({ default: 'observe' })
  action: 'observe';

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
