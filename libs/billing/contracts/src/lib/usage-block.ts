import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { BillingScope, ScopedBillingRecord } from './billing-scope';

export interface UsageBlockGrant extends ScopedBillingRecord {
  accountId: string;
  meterId: string;
  grantedQuantity: number;
  remainingQuantity: number;
  expiresAt?: Date | null;
}

export interface UsageBlockConsumption extends ScopedBillingRecord {
  grantId: string;
  meterId: string;
  quantity: number;
}

export class GrantUsageBlockDto implements BillingScope {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tenantId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  appScope!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  meterId!: string;

  @ApiProperty()
  @IsNumber()
  quantity!: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date | null;
}

export class ConsumeUsageBlockDto implements BillingScope {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tenantId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  appScope!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  meterId!: string;

  @ApiProperty()
  @IsNumber()
  quantity!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  occurredAt?: Date;
}

export interface GrantUsageBlockResult {
  grant: UsageBlockGrant;
}

export interface ConsumeUsageBlockResult {
  requestedQuantity: number;
  consumedQuantity: number;
  unfilledQuantity: number;
  consumptions: UsageBlockConsumption[];
}
