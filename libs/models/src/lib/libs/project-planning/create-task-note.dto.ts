import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsOptional,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTaskNoteDto {
  @ApiProperty({
    type: String,
    description: 'Profile ID of the note author',
  })
  @IsString()
  @IsUUID()
  profileId!: string;

  @ApiProperty({
    type: String,
    description: 'Task ID this note belongs to',
  })
  @IsString()
  @IsUUID()
  taskId!: string;

  @ApiProperty({ type: String, description: 'Content of the note' })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content!: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Optional AI analysis or reflection',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  analysis?: string;
}
