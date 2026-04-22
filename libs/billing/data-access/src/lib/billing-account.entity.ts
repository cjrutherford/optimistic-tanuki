import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BillingAccountStatus } from '@optimistic-tanuki/billing-contracts';

@Entity()
export class BillingAccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column({ type: 'varchar', default: 'billing' })
  appScope: string;

  @Column({ type: 'varchar', nullable: true })
  profileId?: string | null;

  @Column()
  name: string;

  @Column({ type: 'varchar', default: 'active' })
  status: BillingAccountStatus;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
