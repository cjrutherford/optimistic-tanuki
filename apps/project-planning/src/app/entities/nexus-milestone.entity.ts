import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('nexus_milestones')
@Index('IDX_nexus_milestones_tenant_project', ['tenantId', 'projectId'])
export class NexusMilestone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128 })
  tenantId: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'varchar', length: 200 })
  phase: string;

  @Column({ type: 'varchar', length: 32, default: 'planned' })
  status: string;

  @Column({ type: 'timestamp' })
  plannedStart: Date;

  @Column({ type: 'timestamp' })
  plannedEnd: Date;

  @Column({ type: 'timestamp', nullable: true })
  actualStart: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  actualEnd: Date | null;

  @Column({ type: 'int', default: 0 })
  progressPercent: number;

  @Column({ type: 'uuid', array: true, default: '{}' })
  predecessorIds: string[];

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
