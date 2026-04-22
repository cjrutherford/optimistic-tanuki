import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('lp_credit_ledger_entry')
export class CreditLedgerEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 128 })
  offeringId!: string;

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  creditsAwarded!: number;

  @Column({ type: 'uuid' })
  evaluationId!: string;

  @CreateDateColumn()
  awardedAt!: Date;
}
