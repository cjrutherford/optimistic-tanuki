import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderStatus } from '../order-status.enum';

export interface ShippingAddress {
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface ConfigurationDto {
  chassisId: string;
  chassisType: string;
  useCase: string;
  cpuId: string;
  ramId: string;
  storageIds: string[];
  gpuId?: string;
}

export interface PriceBreakdown {
  chassisPrice: number;
  cpuPrice: number;
  ramPrice: number;
  storagePrice: number;
  gpuPrice: number;
  casePrice: number;
  accessoriesPrice: number;
  assemblyFee: number;
  totalPrice: number;
}

@Entity()
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'jsonb' })
  configuration: ConfigurationDto;

  @Column({ type: 'jsonb' })
  priceBreakdown: PriceBreakdown;

  @Column({ type: 'jsonb' })
  shippingAddress: ShippingAddress;

  @Column()
  customerEmail: string;

  @Column({ type: 'varchar', length: 20, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ type: 'timestamp', nullable: true })
  estimatedDelivery: Date | null;

  @Column({ nullable: true })
  ownerId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
