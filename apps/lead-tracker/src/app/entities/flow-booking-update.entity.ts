import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  FLOW_BOOKING_STATUSES,
  FlowBookingStatus,
} from './flow-booking.entity';

@Entity('flow_booking_updates')
@Index(['tenantId', 'bookingId', 'createdAt'])
export class FlowBookingUpdate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 128 })
  tenantId: string;

  @Column({ length: 64 })
  bookingId: string;

  @Column({
    type: 'enum',
    enum: FLOW_BOOKING_STATUSES,
    nullable: true,
  })
  previousStatus?: FlowBookingStatus | null;

  @Column({ type: 'enum', enum: FLOW_BOOKING_STATUSES })
  status: FlowBookingStatus;

  @Column({ length: 32, default: 'system' })
  actor: string;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
