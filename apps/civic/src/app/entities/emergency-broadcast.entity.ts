import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('emergency_broadcasts')
@Index('IDX_emergency_broadcasts_tenant_issued', ['tenantId', 'issuedAt'])
export class EmergencyBroadcast {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128 })
  tenantId: string;

  @Column({ type: 'varchar', length: 32 })
  severity: string;

  @Column({ type: 'varchar', length: 255 })
  headline: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'timestamp' })
  issuedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  audience: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
