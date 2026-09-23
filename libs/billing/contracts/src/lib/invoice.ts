import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsDefined,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';
import { BillingScope, ScopedBillingRecord } from './billing-scope';
import { InvoiceLine } from './invoice-line';
import { InvoicePreviewMeter } from './usage-meter';

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void';

export interface Invoice extends ScopedBillingRecord {
  accountId: string;
  status: InvoiceStatus;
  currency: string;
  subtotalCents: number;
  lines: InvoiceLine[];
}

export class InvoicePreviewInput implements BillingScope {
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
  currency!: string;

  @ApiProperty()
  @IsNumber()
  subscriptionPriceCents!: number;

  @ApiProperty({ type: InvoicePreviewMeter })
  @IsDefined()
  @ValidateNested()
  @Type(() => InvoicePreviewMeter)
  meter!: InvoicePreviewMeter;

  @ApiProperty()
  @IsNumber()
  usageQuantity!: number;

  @ApiProperty()
  @IsNumber()
  usageBlockBalance!: number;
}

export class PeriodInvoicePreviewInput implements BillingScope {
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
  currency!: string;

  @ApiProperty()
  @IsNumber()
  subscriptionPriceCents!: number;

  @ApiProperty({ type: InvoicePreviewMeter })
  @IsDefined()
  @ValidateNested()
  @Type(() => InvoicePreviewMeter)
  meter!: InvoicePreviewMeter;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  periodStart!: Date;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  periodEnd!: Date;
}

export interface InvoicePreview extends BillingScope {
  currency: string;
  subtotalCents: number;
  lines: InvoiceLine[];
}
