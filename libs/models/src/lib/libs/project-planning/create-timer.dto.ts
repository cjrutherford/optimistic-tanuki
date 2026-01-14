import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateTimerDto {
  @ApiProperty({ description: 'Task ID for the timer' })
  @IsUUID()
  taskId: string;
}
