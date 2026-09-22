import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { ScopedBillingRecord } from './billing-scope';

export interface UsageMeter extends ScopedBillingRecord {
  code: string;
  name: string;
  unit: string;
  includedQuantity: number;
  overageUnitPriceCents: number;
}

export class InvoicePreviewMeter {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  unit!: string;

  @ApiProperty()
  @IsNumber()
  includedQuantity!: number;

  @ApiProperty()
  @IsNumber()
  overageUnitPriceCents!: number;
}
