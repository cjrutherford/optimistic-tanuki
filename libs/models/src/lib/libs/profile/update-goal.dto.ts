import { PartialType } from '@nestjs/mapped-types';
import { CreateGoalDto } from './create-goal.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class UpdateGoalDto extends PartialType(CreateGoalDto) {
  @ApiProperty({ description: 'ID of the goal' })
  @IsUUID()
  id!: string;
}
