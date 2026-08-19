import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  WorkspaceKind,
  WorkspaceSourceService,
  WorkspaceStatus,
} from '@optimistic-tanuki/models';

@Entity('workspaces')
@Index(['kind', 'slug'], { unique: true })
@Index(['sourceService', 'sourceId'], { unique: true })
export class Workspace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32 })
  kind: WorkspaceKind;

  @Column({ type: 'varchar', length: 255 })
  slug: string;

  @Column({ type: 'varchar', length: 255 })
  displayName: string;

  @Column({ type: 'varchar', length: 128 })
  appScope: string;

  @Column({ type: 'uuid' })
  ownerUserId: string;

  @Column({ type: 'uuid' })
  ownerProfileId: string;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: WorkspaceStatus;

  @Column({ type: 'varchar', length: 32 })
  sourceService: WorkspaceSourceService;

  @Column({ type: 'uuid' })
  sourceId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
