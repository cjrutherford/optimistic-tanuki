import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { FinanceWorkspace } from './finance-workspace.type';

export class CreateRecurringItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiPropertyOptional({ required: false })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  cadence: string;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  nextDueDate: Date;

  @ApiPropertyOptional({ default: 'scheduled' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ required: false })
  @IsString()
  @IsOptional()
  payeeOrVendor?: string;

  @ApiPropertyOptional({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ required: false })
  @IsString()
  @IsUUID()
  @IsOptional()
  accountId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsUUID()
  @IsOptional()
  profileId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  appScope?: string;

  @ApiPropertyOptional({ default: 'personal' })
  @IsString()
  @IsOptional()
  workspace?: FinanceWorkspace;
}
