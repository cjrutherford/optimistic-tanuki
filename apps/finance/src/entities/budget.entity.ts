import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class Budget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  category: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  limit: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  spent: number;

  @Column()
  period: string; // 'daily', 'weekly', 'monthly', 'yearly'

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

  @Column()
  userId: string;

  @Column()
  profileId: string;

  @Column({ type: 'varchar', default: 'finance' })
  appScope: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  alertOnExceed: boolean;
}
