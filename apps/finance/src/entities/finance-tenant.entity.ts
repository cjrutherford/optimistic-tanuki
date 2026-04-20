import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { FinanceTenantMember } from './finance-tenant-member.entity';
import { FinanceTenantType } from '@optimistic-tanuki/models';

@Entity()
export class FinanceTenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  profileId: string;

  @Column({ type: 'varchar', default: 'finance' })
  appScope: string;

  @Column({ type: 'varchar', nullable: true })
  type?: FinanceTenantType | null;

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

  @OneToMany(() => FinanceTenantMember, (member) => member.tenant)
  members: FinanceTenantMember[];
}
