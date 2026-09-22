import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { FinanceWorkspace } from './finance-workspace.type';

export type FinancialCheckoutSessionStatus =
  | 'pending_provider'
  | 'open'
  | 'paid'
  | 'expired'
  | 'cancelled';

export class CreateFinancialCheckoutSessionDto {
  @ApiPropertyOptional({ required: false })
  @IsString()
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ required: false })
  @IsString()
  @IsUUID()
  @IsOptional()
  profileId?: string;

  @ApiPropertyOptional({ required: false })
  @IsString()
  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @ApiPropertyOptional({ required: false })
  @IsString()
  @IsOptional()
  appScope?: string;

  @ApiPropertyOptional({ default: 'business' })
  @IsString()
  @IsOptional()
  workspace?: FinanceWorkspace;

  @ApiPropertyOptional({ required: false })
  @IsString()
  @IsUUID()
  @IsOptional()
  invoiceId?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({ default: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @ApiPropertyOptional({ required: false })
  @IsEmail()
  @IsOptional()
  customerEmail?: string;

  @ApiPropertyOptional({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ required: false })
  @IsString()
  @IsOptional()
  successUrl?: string;

  @ApiPropertyOptional({ required: false })
  @IsString()
  @IsOptional()
  cancelUrl?: string;
}

export class FinancialCheckoutSessionDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ required: false })
  invoiceId?: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  customerName: string;

  @ApiProperty({ required: false })
  customerEmail?: string;

  @ApiProperty()
  status: FinancialCheckoutSessionStatus;

  @ApiProperty({ required: false })
  providerCheckoutUrl?: string;

  @ApiProperty()
  workspace: FinanceWorkspace;
}
