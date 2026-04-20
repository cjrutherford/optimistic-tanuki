import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsDate,
  IsNotEmpty,
  IsUUID,
  IsOptional,
} from 'class-validator';
import { FinanceWorkspace } from './finance-workspace.type';
import {
  BankSyncSourceType,
  BankTransactionReviewStatus,
} from './bank-connection.dto';

export class CreateTransactionDto {
  @ApiProperty({ description: 'The amount of the transaction' })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ description: 'The type of the transaction' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'The category of the transaction' })
  @IsString()
  @IsOptional()
  category: string;

  @ApiProperty({ description: 'Description of the transaction' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'The ID of the user creating the transaction' })
  @IsString()
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiProperty({
    description: 'The ID of the profile creating the transaction',
  })
  @IsString()
  @IsUUID()
  @IsOptional()
  profileId?: string;

  @ApiProperty({ description: 'The ID of the finance tenant' })
  @IsString()
  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @ApiProperty({ description: 'App scope for the transaction' })
  @IsString()
  @IsOptional()
  appScope?: string;

  @ApiProperty({
    description: 'The ID of the account associated with the transaction',
  })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty({ description: 'The date of the transaction' })
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  transactionDate: Date;

  @ApiProperty({ description: 'Reference for the transaction' })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiProperty({ description: 'Whether the transaction is recurring' })
  @IsBoolean()
  @IsNotEmpty()
  isRecurring: boolean;

  @ApiProperty({
    description: 'Workspace for the transaction',
    required: false,
    default: 'personal',
  })
  @IsString()
  @IsOptional()
  workspace?: FinanceWorkspace;

  @ApiProperty({ description: 'Payee or vendor', required: false })
  @IsString()
  @IsOptional()
  payeeOrVendor?: string;

  @ApiProperty({ description: 'Transfer classification', required: false })
  @IsString()
  @IsOptional()
  transferType?: string;

  @ApiProperty({ required: false, enum: BankSyncSourceType })
  @IsOptional()
  sourceType?: BankSyncSourceType;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  sourceProvider?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  externalTransactionId?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  pending?: boolean;

  @ApiProperty({ required: false, enum: BankTransactionReviewStatus })
  @IsOptional()
  reviewStatus?: BankTransactionReviewStatus;
}
