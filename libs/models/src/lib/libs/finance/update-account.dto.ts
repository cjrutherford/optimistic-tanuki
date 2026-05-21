import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsNumber, IsBoolean, IsOptional, IsDate } from 'class-validator';
import { FinanceWorkspace } from './finance-workspace.type';

export class UpdateAccountDto {
  @ApiProperty({ description: 'The name of the account', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'The type of the account', required: false })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiProperty({ description: 'The balance of the account', required: false })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  balance?: number;

  @ApiProperty({ description: 'Description of the account', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Whether the account is active', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ description: 'Workspace for the account', required: false })
  @IsString()
  @IsOptional()
  workspace?: FinanceWorkspace;

  @ApiProperty({ description: 'The date the account was last reviewed', required: false })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  lastReviewedAt?: Date;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  providerConnectionId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  providerAccountId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  institutionName?: string;
}
