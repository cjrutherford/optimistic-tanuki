import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BankConnection } from './bank-connection.entity';
import { Account } from './account.entity';

@Entity()
export class LinkedBankAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  connectionId: string;

  @ManyToOne(() => BankConnection, (connection) => connection.linkedAccounts)
  @JoinColumn({ name: 'connectionId' })
  connection: BankConnection;

  @Column('uuid')
  financeAccountId: string;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'financeAccountId' })
  financeAccount: Account;

  @Column()
  providerAccountId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  mask: string | null;

  @Column({ nullable: true })
  subtype: string | null;

  @Column({ nullable: true })
  providerType: string | null;

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
}
