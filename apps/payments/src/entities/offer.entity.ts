import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type OfferStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'countered'
  | 'withdrawn'
  | 'expired';

export const DEFAULT_OFFER_EXPIRY_DAYS = 7;

@Entity('offers')
@Index(['classifiedId'])
@Index(['buyerId'])
@Index(['sellerId'])
@Index(['status'])
export class Offer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  classifiedId: string;

  @Column({ type: 'uuid' })
  buyerId: string;

  @Column({ type: 'uuid' })
  sellerId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  offeredAmount: number;

  @Column({
    type: 'varchar',
    default: 'pending',
  })
  status: OfferStatus;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  counterOfferAmount: number;

  @Column({ type: 'text', nullable: true })
  counterMessage: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'uuid', nullable: true })
  acceptedPaymentId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
