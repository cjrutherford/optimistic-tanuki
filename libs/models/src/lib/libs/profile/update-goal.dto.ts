import { PartialType } from '@nestjs/mapped-types';
import { CreateGoalDto } from './create-goal.dto';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateGoalDto extends PartialType(CreateGoalDto) {
  @ApiProperty({ description: 'ID of the goal' })
  id: string;
}
