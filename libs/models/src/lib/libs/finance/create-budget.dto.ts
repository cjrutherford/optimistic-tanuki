import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsBoolean, IsDate, IsNotEmpty, IsUUID } from 'class-validator';

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

  @ApiProperty({ description: 'The ID of the user creating the budget' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'The ID of the profile creating the budget' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  profileId: string;

  @ApiProperty({ description: 'App scope for the budget' })
  @IsString()
  @IsNotEmpty()
  appScope: string;

  @ApiProperty({ description: 'Whether to alert on exceed' })
  @IsBoolean()
  @IsNotEmpty()
  alertOnExceed: boolean;
}
