import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { FinanceWorkspace } from './finance-workspace.type';

export type FinancialInvoiceStatus =
  | 'draft'
  | 'sent'
  | 'partially_paid'
  | 'paid'
  | 'void'
  | 'overdue';

export class FinancialInvoiceLineDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  quantity: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  unitAmount: number;
}

export class CreateFinancialInvoiceDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsUUID()
  @IsOptional()
  profileId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  appScope?: string;

  @ApiProperty({ default: 'business' })
  @IsString()
  @IsOptional()
  workspace?: FinanceWorkspace;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  customerEmail?: string;

  @ApiProperty({ default: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ required: false })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  dueDate?: Date;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ type: [FinancialInvoiceLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FinancialInvoiceLineDto)
  lines: FinancialInvoiceLineDto[];
}

export class UpdateFinancialInvoiceDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  customerName?: string;

  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  customerEmail?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ required: false })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  dueDate?: Date;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ required: false, type: [FinancialInvoiceLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FinancialInvoiceLineDto)
  @IsOptional()
  lines?: FinancialInvoiceLineDto[];
}

export class RecordFinancialInvoicePaymentDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  amount: number;

  @ApiProperty()
  @IsString()
  @IsUUID()
  accountId: string;

  @ApiProperty({ required: false })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  paidAt?: Date;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  method?: string;
}

export class FinancialInvoiceDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  invoiceNumber: string;

  @ApiProperty()
  customerName: string;

  @ApiProperty({ required: false })
  customerEmail?: string;

  @ApiProperty()
  status: FinancialInvoiceStatus;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  subtotal: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  amountPaid: number;

  @ApiProperty()
  workspace: FinanceWorkspace;

  @ApiProperty({ type: [FinancialInvoiceLineDto] })
  lines: FinancialInvoiceLineDto[];
}
