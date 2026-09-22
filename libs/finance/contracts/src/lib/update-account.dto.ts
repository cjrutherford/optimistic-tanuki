import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsDate,
} from 'class-validator';
import { FinanceWorkspace } from './finance-workspace.type';

export class UpdateAccountDto {
  @ApiPropertyOptional({
    description: 'The name of the account',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'The type of the account',
    required: false,
  })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiProperty({ description: 'The balance of the account', required: false })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  balance?: number;

  @ApiPropertyOptional({
    description: 'Description of the account',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether the account is active',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Workspace for the account',
    required: false,
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
