import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
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

export class CreateBudgetDto {
  @ApiProperty({ description: 'The name of the budget' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'The category of the budget' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ description: 'The limit of the budget' })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  limit: number;

  @ApiProperty({ description: 'The spent amount of the budget' })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  spent: number;

  @ApiProperty({ description: 'The period of the budget' })
  @IsString()
  @IsNotEmpty()
  period: string;

  @ApiProperty({ description: 'The start date of the budget' })
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  startDate: Date;

  @ApiProperty({ description: 'The end date of the budget' })
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  endDate: Date;

  @ApiProperty({ description: 'The ID of the user creating the budget' })
  @IsString()
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiProperty({ description: 'The ID of the profile creating the budget' })
  @IsString()
  @IsUUID()
  @IsOptional()
  profileId?: string;

  @ApiProperty({ description: 'The ID of the finance tenant' })
  @IsString()
  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @ApiProperty({ description: 'App scope for the budget' })
  @IsString()
  @IsOptional()
  appScope?: string;

  @ApiProperty({ description: 'Whether to alert on exceed' })
  @IsBoolean()
  @IsNotEmpty()
  alertOnExceed: boolean;

  @ApiProperty({
    description: 'Workspace for the budget',
    required: false,
    default: 'personal',
  })
  @IsString()
  @IsOptional()
  workspace?: FinanceWorkspace;
}
