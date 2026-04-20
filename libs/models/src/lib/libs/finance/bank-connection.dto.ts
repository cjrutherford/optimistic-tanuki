import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { FinanceWorkspace } from './finance-workspace.type';

export enum BankConnectionStatus {
  HEALTHY = 'healthy',
  NEEDS_REAUTH = 'needs-reauth',
  SYNC_ERROR = 'sync-error',
  DISCONNECTED = 'disconnected',
}

export enum BankSyncSourceType {
  MANUAL = 'manual',
  IMPORT = 'import',
  BANK_SYNC = 'bank-sync',
}

export enum BankTransactionReviewStatus {
  NEEDS_REVIEW = 'needs-review',
  REVIEWED = 'reviewed',
}

export class BankConnectionLinkTokenDto {
  @ApiProperty({ default: 'plaid' })
  @IsString()
  @IsNotEmpty()
  provider: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  redirectUri?: string;
}

export class BankLinkTokenResponseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  provider: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  linkToken: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  expiration?: string;
}

export class LinkedBankAccountDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  id: string;

  @ApiProperty()
  @IsString()
  @IsUUID()
  connectionId: string;

  @ApiProperty()
  @IsString()
  @IsUUID()
  financeAccountId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  providerAccountId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  mask?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  subtype?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  providerType?: string;

  @ApiProperty()
  @IsBoolean()
  isActive: boolean;
}

export class BankConnectionDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  id: string;

  @ApiProperty({ default: 'plaid' })
  @IsString()
  @IsNotEmpty()
  provider: string;

  @ApiProperty({ enum: BankConnectionStatus })
  @IsEnum(BankConnectionStatus)
  status: BankConnectionStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  institutionId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  institutionName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  lastError?: string;

  @ApiProperty({ required: false })
  @IsDate()
  @IsOptional()
  lastSuccessfulSyncAt?: Date;

  @ApiProperty({ required: false })
  @IsDate()
  @IsOptional()
  lastAttemptedSyncAt?: Date;

  @ApiProperty()
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({ type: [LinkedBankAccountDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LinkedBankAccountDto)
  linkedAccounts: LinkedBankAccountDto[];
}

export class BankProviderAccountDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  providerAccountId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  mask?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  subtype?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  balance: number;

  @ApiProperty({ default: 'USD' })
  @IsString()
  @IsNotEmpty()
  currency: string;
}

export class BankConnectionExchangeDto {
  @ApiProperty({ default: 'plaid' })
  @IsString()
  @IsNotEmpty()
  provider: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  publicToken: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  institutionId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  institutionName?: string;

  @ApiProperty({ required: false, default: 'personal' })
  @IsString()
  @IsOptional()
  workspace?: FinanceWorkspace;
}

export class BankConnectionCreateDto extends BankConnectionExchangeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  accessToken: string;

  @ApiProperty({ enum: BankConnectionStatus })
  @IsEnum(BankConnectionStatus)
  status: BankConnectionStatus;

  @ApiProperty({ type: [BankProviderAccountDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankProviderAccountDto)
  accounts: BankProviderAccountDto[];

  @ApiProperty()
  @IsString()
  @IsUUID()
  userId: string;

  @ApiProperty()
  @IsString()
  @IsUUID()
  profileId: string;

  @ApiProperty()
  @IsString()
  @IsUUID()
  tenantId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  appScope: string;
}

export class BankSyncRequestDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  connectionId: string;
}

export class BankSyncResultDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  added: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  modified: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  removed: number;
}
