import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('vault_tokens')
@Index('UQ_vault_tokens_jti', ['jti'], { unique: true })
@Index('IDX_vault_tokens_tenant', ['tenantId'])
export class VaultTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128 })
  jti: string;

  @Column({ type: 'varchar', length: 128 })
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  documentId: string;

  @Column({ type: 'varchar', length: 64 })
  purpose: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  consumedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  issuedBy: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
