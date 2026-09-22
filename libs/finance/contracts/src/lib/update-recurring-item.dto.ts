import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { FinanceWorkspace } from './finance-workspace.type';

export class UpdateRecurringItemDto {
  @ApiPropertyOptional({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({ required: false })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ required: false })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ required: false })
  @IsString()
  @IsOptional()
  cadence?: string;

  @ApiProperty({ required: false })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  nextDueDate?: Date;

  @ApiPropertyOptional({ required: false })
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

  @ApiPropertyOptional({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ required: false })
  @IsString()
  @IsOptional()
  workspace?: FinanceWorkspace;
}
