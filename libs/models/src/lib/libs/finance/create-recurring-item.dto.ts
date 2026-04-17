import { ApiProperty } from '@nestjs/swagger';
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

  @ApiProperty({ required: false })
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

  @ApiProperty({ default: 'scheduled' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  payeeOrVendor?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsUUID()
  @IsOptional()
  accountId?: string;

  @ApiProperty()
  @IsString()
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiProperty()
  @IsString()
  @IsUUID()
  @IsOptional()
  profileId?: string;

  @ApiProperty()
  @IsString()
  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  appScope?: string;

  @ApiProperty({ default: 'personal' })
  @IsString()
  @IsOptional()
  workspace?: FinanceWorkspace;
}
