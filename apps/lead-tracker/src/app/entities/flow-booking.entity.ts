import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export const FLOW_BOOKING_STATUSES = [
  'scheduled',
  'en_route',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export type FlowBookingStatus = (typeof FLOW_BOOKING_STATUSES)[number];

@Entity('flow_bookings')
@Unique(['tenantId', 'idempotencyKey'])
@Index(['tenantId', 'status', 'scheduledDate'])
@Index(['tenantId', 'serviceId', 'scheduledDate', 'arrivalWindow'])
export class FlowBooking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 128 })
  tenantId: string;

  @Column({ length: 64, unique: true })
  bookingId: string;

  @Column({ length: 32, unique: true })
  trackingCode: string;

  @Column({ length: 64 })
  estimateId: string;

  @Column({ length: 160 })
  customerName: string;

  @Column({ length: 40 })
  customerPhone: string;

  @Column({ length: 254 })
  customerEmail: string;

  @Column({ length: 240 })
  serviceAddress: string;

  @Column({ length: 80, nullable: true })
  gateCode?: string | null;

  @Column({ length: 120 })
  serviceId: string;

  @Column({ length: 120 })
  servicePackage: string;

  @Column({ length: 160 })
  serviceName: string;

  @Column({ type: 'date' })
  scheduledDate: string;

  @Column({ length: 120 })
  arrivalWindow: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  photoUrls: string[];

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  depositAmount: number;

  @Column({ default: false })
  depositPaid: boolean;

  @Column({
    type: 'enum',
    enum: FLOW_BOOKING_STATUSES,
    default: 'scheduled',
  })
  status: FlowBookingStatus;

  @Column({ length: 200 })
  idempotencyKey: string;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
