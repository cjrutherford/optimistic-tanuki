import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsDate, IsOptional, IsNumber, IsBoolean, IsUUID } from 'class-validator';
import { FinanceWorkspace } from './finance-workspace.type';
import {
  BankSyncSourceType,
  BankTransactionReviewStatus,
} from './bank-connection.dto';

export class UpdateTransactionDto {
  @ApiProperty({ description: 'The amount of the transaction', required: false })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  amount?: number;

  @ApiProperty({ description: 'The type of the transaction', required: false })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiProperty({ description: 'The account associated with the transaction', required: false })
  @IsString()
  @IsUUID()
  @IsOptional()
  accountId?: string;

  @ApiProperty({ description: 'Description of the transaction', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'The category of the transaction', required: false })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ description: 'The date of the transaction', required: false })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  transactionDate?: Date;

  @ApiProperty({ description: 'Reference for the transaction', required: false })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiProperty({ description: 'Whether the transaction is recurring', required: false })
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @ApiProperty({ description: 'Workspace for the transaction', required: false })
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
