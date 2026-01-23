import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTaskTimeEntryDto {
  @ApiProperty({ description: 'Task ID for the time entry' })
  @IsUUID()
  taskId: string;

  @ApiProperty({
    description: 'Optional description for this time entry',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ description: 'User who created the time entry' })
  @IsString()
  @IsUUID()
  createdBy: string;
}
