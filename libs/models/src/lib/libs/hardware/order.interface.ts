import { OrderStatus } from './order-status.enum';
import { ChassisType } from './chassis-type.enum';
import { ChassisUseCase } from './chassis-usecase.enum';

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
  chassisType: ChassisType;
  useCase: ChassisUseCase;
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

export interface Order {
  id: string;
  configuration: ConfigurationDto;
  priceBreakdown: PriceBreakdown;
  shippingAddress: ShippingAddress;
  customerEmail: string;
  status: OrderStatus;
  ownerId?: string;
  estimatedDelivery?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface HardwareCreateOrderDto {
  configuration: ConfigurationDto;
  shippingAddress: ShippingAddress;
  customerEmail: string;
}
