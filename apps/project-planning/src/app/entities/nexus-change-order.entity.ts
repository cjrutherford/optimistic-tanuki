import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type NexusChangeOrderSignature = {
  name: string;
  role: string;
  signaturePng: string;
  signedAt: string;
};

@Entity('nexus_change_orders')
@Index('IDX_nexus_change_orders_tenant_project', ['tenantId', 'projectId'])
export class NexusChangeOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128 })
  tenantId: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'bigint' })
  amountCents: number;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: string;

  @Column({ type: 'jsonb', default: [] })
  signatures: NexusChangeOrderSignature[];

  @Column({ type: 'varchar', length: 512, nullable: true })
  documentKey: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
