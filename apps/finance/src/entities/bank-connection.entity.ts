import { BankConnectionStatus } from '@optimistic-tanuki/models';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { LinkedBankAccount } from './linked-bank-account.entity';

@Entity()
export class BankConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  provider: string;

  @Column()
  itemId: string;

  @Column({ type: 'text' })
  accessToken: string;

  @Column({ nullable: true })
  institutionId: string;

  @Column({ nullable: true })
  institutionName: string;

  @Column({ type: 'varchar', default: BankConnectionStatus.HEALTHY })
  status: BankConnectionStatus;

  @Column({ type: 'text', nullable: true })
  lastCursor: string | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastSuccessfulSyncAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastAttemptedSyncAt: Date | null;

  @Column()
  userId: string;

  @Column()
  profileId: string;

  @Column('uuid')
  tenantId: string;

  @Column({ type: 'varchar', default: 'finance' })
  appScope: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @OneToMany(() => LinkedBankAccount, (linkedAccount) => linkedAccount.connection)
  linkedAccounts: LinkedBankAccount[];
}
