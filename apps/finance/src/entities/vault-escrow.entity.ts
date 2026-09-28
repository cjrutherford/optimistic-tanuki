import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('vault_escrows')
@Index('UQ_vault_escrows_tenant_token', ['tenantId', 'token'], { unique: true })
@Index('IDX_vault_escrows_tenant_active', ['tenantId', 'active'])
export class VaultEscrowEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 512 })
  token: string;

  @Column({ type: 'varchar', length: 128 })
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  beneficiary: string;

  @Column({ type: 'varchar', length: 255 })
  bankName: string;

  @Column({ type: 'text' })
  encryptedRoutingNumber: string;

  @Column({ type: 'varchar', length: 64 })
  routingNumberIv: string;

  @Column({ type: 'varchar', length: 64 })
  routingNumberAuthTag: string;

  @Column({ type: 'text' })
  encryptedAccountNumber: string;

  @Column({ type: 'varchar', length: 64 })
  accountNumberIv: string;

  @Column({ type: 'varchar', length: 64 })
  accountNumberAuthTag: string;

  @Column({ type: 'text' })
  encryptedTotpSecret: string;

  @Column({ type: 'varchar', length: 64 })
  totpSecretIv: string;

  @Column({ type: 'varchar', length: 64 })
  totpSecretAuthTag: string;

  @Column({ type: 'varchar', length: 255 })
  reference: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
