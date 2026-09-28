import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tip_projects')
@Index('IDX_tip_projects_tenant', ['tenantId'])
export class TipProject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128 })
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb' })
  geometry: Record<string, unknown>;

  @Column({ type: 'bigint' })
  fundingAllocatedCents: number;

  @Column({ type: 'bigint', default: 0 })
  fundingSpentCents: number;

  @Column({ type: 'varchar', length: 64 })
  status: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  milestone: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
