import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { BillingScope, ScopedBillingRecord } from './billing-scope';

export interface UsageEvent extends ScopedBillingRecord {
  meterId: string;
  eventKey: string;
  quantity: number;
  occurredAt: Date;
  metadata?: Record<string, unknown>;
}

export class RecordUsageDto implements BillingScope {
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
  meterId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  eventKey!: string;

  @ApiProperty()
  @IsNumber()
  quantity!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  occurredAt?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class BatchRecordUsageDto {
  @ApiProperty({ type: [RecordUsageDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecordUsageDto)
  events!: RecordUsageDto[];
}

export interface RecordUsageResult {
  accepted: boolean;
  duplicate: boolean;
  event: UsageEvent;
}
