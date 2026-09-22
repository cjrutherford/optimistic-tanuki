import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AppointmentEntity } from './appointment.entity';

@Entity('appointment_receipts')
export class InvoiceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  appointmentId: string;

  @ManyToOne(() => AppointmentEntity)
  @JoinColumn({ name: 'appointmentId' })
  appointment: AppointmentEntity;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  invoiceNumber: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', length: 50, default: 'unpaid' })
  status: string; // 'unpaid', 'paid', 'cancelled'

  // E5: reference to the canonical billing quote minted for this receipt.
  // Set when the receipt originates from (or is later linked to) a billing
  // invoice; null for legacy appointment-only receipts.
  @Column({ type: 'uuid', nullable: true })
  billingInvoiceId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
