import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class UsageBlockGrantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column({ type: 'varchar', default: 'billing' })
  appScope: string;

  @Column()
  accountId: string;

  @Column()
  meterId: string;

  @Column({ type: 'int' })
  grantedQuantity: number;

  @Column({ type: 'int' })
  remainingQuantity: number;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
