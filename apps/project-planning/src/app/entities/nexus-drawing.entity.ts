import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('nexus_drawings')
@Index('IDX_nexus_drawings_tenant_project', ['tenantId', 'projectId'])
export class NexusDrawing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128 })
  tenantId: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 64 })
  version: string;

  @Column({ type: 'varchar', length: 512 })
  storageKey: string;

  @Column({ type: 'varchar', length: 64 })
  sha256: string;

  @Column({ type: 'varchar', length: 32, default: 'unverified' })
  coiStatus: string;

  @Column({ type: 'timestamp', nullable: true })
  coiExpiresAt: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
