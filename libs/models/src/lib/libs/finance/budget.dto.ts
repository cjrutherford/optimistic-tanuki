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

export class BudgetDto {
  @ApiProperty({ description: 'The unique identifier of the budget' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'The name of the budget' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'The category of the budget' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ description: 'The limit of the budget' })
  @IsNumber()
  @IsNotEmpty()
  limit: number;

  @ApiProperty({ description: 'The spent amount of the budget' })
  @IsNumber()
  @IsNotEmpty()
  spent: number;

  @ApiProperty({ description: 'The period of the budget' })
  @IsString()
  @IsNotEmpty()
  period: string;

  @ApiProperty({ description: 'The start date of the budget' })
  @IsDate()
  @IsNotEmpty()
  startDate: Date;

  @ApiProperty({ description: 'The end date of the budget' })
  @IsDate()
  @IsNotEmpty()
  endDate: Date;

  @ApiProperty({ description: 'The ID of the user who owns the budget' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'The ID of the profile associated with the budget',
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

  @ApiProperty({ description: 'App scope for the budget' })
  @IsString()
  @IsNotEmpty()
  appScope: string;

  @ApiProperty({ description: 'Workspace for the budget' })
  @IsString()
  @IsNotEmpty()
  workspace: FinanceWorkspace;

  @ApiProperty({ description: 'The date the budget was created' })
  @IsDate()
  @IsNotEmpty()
  createdAt: Date;

  @ApiProperty({ description: 'The date the budget was last updated' })
  @IsDate()
  @IsNotEmpty()
  updatedAt: Date;

  @ApiProperty({ description: 'Whether the budget is active' })
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;

  @ApiProperty({ description: 'Whether to alert on exceed' })
  @IsBoolean()
  @IsNotEmpty()
  alertOnExceed: boolean;
}
