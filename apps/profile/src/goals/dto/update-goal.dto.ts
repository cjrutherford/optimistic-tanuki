import { PartialType } from '@nestjs/mapped-types';
import { CreateGoalDto } from './create-goal.dto';

export class UpdateGoalDto extends PartialType(CreateGoalDto) {
  id: string;

  title?: string;
  description?: string;
  completed?: boolean;
  dueDate?: Date;
}
