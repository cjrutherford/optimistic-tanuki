import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export interface ChassisSpecifications {
  formFactor: string;
  maxPower: string;
  noiseLevel: string;
  dimensions: string;
}

export interface Chassis {
  id: string;
  type: 'XS' | 'S' | 'M' | 'L';
  useCase: 'cloud' | 'nas' | 'dev' | 'hybrid' | 'enterprise';
  name: string;
  description: string;
  basePrice: number;
  specifications: ChassisSpecifications;
  isActive: boolean;
}

export interface HardwareComponent {
  id: string;
  type: 'cpu' | 'ram' | 'storage' | 'gpu';
  name: string;
  description: string;
  basePrice: number;
  sellingPrice: number;
  specs: Record<string, string | number>;
  compatibleWith: string[];
  inStock: boolean;
  isActive: boolean;
}

export interface CompatibleComponents {
  cpu: HardwareComponent[];
  ram: HardwareComponent[];
  storage: HardwareComponent[];
  gpu: HardwareComponent[];
}

export type PaymentMethod = 'card' | 'cash-app' | 'venmo' | 'zelle' | 'cash';

export class ConfigurationDto {
  @ApiProperty()
  @IsString()
  chassisId!: string;

  @ApiProperty()
  @IsString()
  chassisType!: string;

  @ApiProperty()
  @IsString()
  useCase!: string;

  @ApiProperty()
  @IsString()
  cpuId!: string;

  @ApiProperty()
  @IsString()
  ramId!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  storageIds!: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
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

export class ShippingAddressDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  street!: string;

  @ApiProperty()
  @IsString()
  city!: string;

  @ApiProperty()
  @IsString()
  state!: string;

  @ApiProperty()
  @IsString()
  zip!: string;

  @ApiProperty()
  @IsString()
  country!: string;
}

export interface HardwareOrder {
  id: string;
  configuration: ConfigurationDto;
  priceBreakdown: PriceBreakdown;
  shippingAddress: ShippingAddressDto;
  customerEmail: string;
  paymentMethod: PaymentMethod;
  status: string;
  estimatedDelivery: Date | null;
  createdAt: Date;
}

export class CreateHardwareOrderDto {
  @ApiProperty({ type: () => ConfigurationDto })
  @ValidateNested()
  @Type(() => ConfigurationDto)
  configuration!: ConfigurationDto;

  @ApiProperty({ type: () => ShippingAddressDto })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress!: ShippingAddressDto;

  @ApiProperty()
  @IsEmail()
  customerEmail!: string;

  @ApiProperty({ enum: ['card', 'cash-app', 'venmo', 'zelle', 'cash'] })
  @IsIn(['card', 'cash-app', 'venmo', 'zelle', 'cash'])
  paymentMethod!: PaymentMethod;
}

export interface SavedHardwareConfiguration {
  id: string;
  label: string;
  customerEmail: string;
  configuration: ConfigurationDto;
  priceBreakdown: PriceBreakdown;
  createdAt: Date;
}

export class SaveHardwareConfigurationDto {
  @ApiProperty({ type: () => ConfigurationDto })
  @ValidateNested()
  @Type(() => ConfigurationDto)
  configuration!: ConfigurationDto;

  @ApiProperty()
  @IsString()
  label!: string;

  @ApiProperty()
  @IsEmail()
  customerEmail!: string;
}
