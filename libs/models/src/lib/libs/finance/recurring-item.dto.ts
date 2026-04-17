import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { FinanceWorkspace } from './finance-workspace.type';

export class RecurringItemDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
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
  @IsDate()
  @IsNotEmpty()
  nextDueDate: Date;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  status: string;

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
  @IsNotEmpty()
  userId: string;

  @ApiProperty()
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  profileId: string;

  @ApiProperty()
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  tenantId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  appScope: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  workspace: FinanceWorkspace;

  @ApiProperty()
  @IsDate()
  @IsNotEmpty()
  createdAt: Date;

  @ApiProperty()
  @IsDate()
  @IsNotEmpty()
  updatedAt: Date;

  @ApiProperty()
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;
}
