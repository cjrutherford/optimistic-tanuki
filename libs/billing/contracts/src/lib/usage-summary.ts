import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsString } from 'class-validator';
import { BillingScope } from './billing-scope';

export interface UsageSummary extends BillingScope {
  meterId: string;
  periodStart: Date;
  periodEnd: Date;
  quantity: number;
}

export class UsageSummaryRequest implements BillingScope {
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
  @IsDate()
  @Type(() => Date)
  periodStart!: Date;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  periodEnd!: Date;
}
