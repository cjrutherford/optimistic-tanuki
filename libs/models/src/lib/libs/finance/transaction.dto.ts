import { ApiProperty } from '@nestjs/swagger';
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

export class TransactionDto {
  @ApiProperty({ description: 'The unique identifier of the transaction' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'The amount of the transaction' })
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

  @ApiProperty({
    description: 'The ID of the user who created the transaction',
  })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'The ID of the profile associated with the transaction',
  })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  profileId: string;

  @ApiProperty({ description: 'The ID of the finance tenant' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  tenantId: string;

  @ApiProperty({ description: 'App scope for the transaction' })
  @IsString()
  @IsNotEmpty()
  appScope: string;

  @ApiProperty({ description: 'Workspace for the transaction' })
  @IsString()
  @IsNotEmpty()
  workspace: FinanceWorkspace;

  @ApiProperty({
    description: 'The ID of the account associated with the transaction',
  })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty({ description: 'The date of the transaction' })
  @IsDate()
  @IsNotEmpty()
  transactionDate: Date;

  @ApiProperty({ description: 'The date the transaction was created' })
  @IsDate()
  @IsNotEmpty()
  createdAt: Date;

  @ApiProperty({ description: 'The date the transaction was last updated' })
  @IsDate()
  @IsNotEmpty()
  updatedAt: Date;

  @ApiProperty({ description: 'Reference for the transaction' })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiProperty({ description: 'Whether the transaction is recurring' })
  @IsBoolean()
  @IsNotEmpty()
  isRecurring: boolean;

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
