import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('nexus_inspection_photos')
@Index('IDX_nexus_inspection_photos_tenant_project', ['tenantId', 'projectId'])
export class NexusInspectionPhoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128 })
  tenantId: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'varchar', length: 512 })
  storageKey: string;

  @Column({ type: 'varchar', length: 64 })
  sha256: string;

  @Column({ type: 'double precision', nullable: true })
  gpsLatitude: number | null;

  @Column({ type: 'double precision', nullable: true })
  gpsLongitude: number | null;

  @Column({ type: 'varchar', length: 64, default: 'not_scanned' })
  antivirusStatus: string;

  @Column({ type: 'timestamp' })
  capturedAt: Date;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
