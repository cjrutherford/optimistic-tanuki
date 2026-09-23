import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsDate,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { FinanceWorkspace } from './finance-workspace.type';
import {
  BankSyncSourceType,
  BankTransactionReviewStatus,
} from './bank-connection.dto';

export class UpdateTransactionDto {
  @ApiProperty({
    description: 'The amount of the transaction',
    required: false,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({
    description: 'The type of the transaction',
    required: false,
  })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({
    description: 'The account associated with the transaction',
    required: false,
  })
  @IsString()
  @IsUUID()
  @IsOptional()
  accountId?: string;

  @ApiPropertyOptional({
    description: 'Description of the transaction',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'The category of the transaction',
    required: false,
  })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ description: 'The date of the transaction', required: false })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  transactionDate?: Date;

  @ApiPropertyOptional({
    description: 'Reference for the transaction',
    required: false,
  })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiPropertyOptional({
    description: 'Whether the transaction is recurring',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @ApiPropertyOptional({
    description: 'Workspace for the transaction',
    required: false,
  })
  @IsString()
  @IsOptional()
  workspace?: FinanceWorkspace;

  @ApiPropertyOptional({ description: 'Payee or vendor', required: false })
  @IsString()
  @IsOptional()
  payeeOrVendor?: string;

  @ApiPropertyOptional({
    description: 'Transfer classification',
    required: false,
  })
  @IsString()
  @IsOptional()
  transferType?: string;

  @ApiPropertyOptional({ required: false, enum: BankSyncSourceType })
  @IsOptional()
  sourceType?: BankSyncSourceType;

  @ApiPropertyOptional({ required: false })
  @IsString()
  @IsOptional()
  sourceProvider?: string;

  @ApiPropertyOptional({ required: false })
  @IsString()
  @IsOptional()
  externalTransactionId?: string;

  @ApiPropertyOptional({ required: false })
  @IsBoolean()
  @IsOptional()
  pending?: boolean;

  @ApiPropertyOptional({ required: false, enum: BankTransactionReviewStatus })
  @IsOptional()
  reviewStatus?: BankTransactionReviewStatus;
}
