import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsNumber, IsBoolean, IsOptional } from 'class-validator';
import { FinanceWorkspace } from './finance-workspace.type';

export class UpdateBudgetDto {
  @ApiProperty({ description: 'The name of the budget', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'The category of the budget', required: false })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ description: 'The limit of the budget', required: false })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  limit?: number;

  @ApiProperty({ description: 'The spent amount of the budget', required: false })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  spent?: number;

  @ApiProperty({ description: 'The period of the budget', required: false })
  @IsString()
  @IsOptional()
  period?: string;

  @ApiProperty({ description: 'Whether the budget is active', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ description: 'Whether to alert on exceed', required: false })
  @IsBoolean()
  @IsOptional()
  alertOnExceed?: boolean;

  @ApiProperty({ description: 'Workspace for the budget', required: false })
  @IsString()
  @IsOptional()
  workspace?: FinanceWorkspace;
}
