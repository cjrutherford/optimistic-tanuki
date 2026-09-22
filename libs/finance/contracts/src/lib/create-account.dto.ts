import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsDate,
} from 'class-validator';
import { FinanceWorkspace } from './finance-workspace.type';

export class CreateAccountDto {
  @ApiProperty({ description: 'The name of the account' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'The type of the account' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'The balance of the account' })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  balance: number;

  @ApiProperty({ description: 'The currency of the account' })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiPropertyOptional({
    description: 'The ID of the user creating the account',
  })
  @IsString()
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description: 'The ID of the profile creating the account',
  })
  @IsString()
  @IsUUID()
  @IsOptional()
  profileId?: string;

  @ApiPropertyOptional({ description: 'The ID of the finance tenant' })
  @IsString()
  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @ApiPropertyOptional({ description: 'App scope for the account' })
  @IsString()
  @IsOptional()
  appScope?: string;

  @ApiPropertyOptional({
    description: 'Description of the account',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Workspace for the account',
    required: false,
    default: 'personal',
  })
  @IsString()
  @IsOptional()
  workspace?: FinanceWorkspace;

  @ApiProperty({
    description: 'The date the account was last reviewed',
    required: false,
  })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  lastReviewedAt?: Date;

  @ApiPropertyOptional({ required: false })
  @IsString()
  @IsOptional()
  providerConnectionId?: string;

  @ApiPropertyOptional({ required: false })
  @IsString()
  @IsOptional()
  providerAccountId?: string;

  @ApiPropertyOptional({ required: false })
  @IsString()
  @IsOptional()
  institutionName?: string;
}
