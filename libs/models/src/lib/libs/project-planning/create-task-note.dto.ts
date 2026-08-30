import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsOptional,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTaskNoteDto {
  /**
   * Who wrote the note.
   *
   * Optional because the gateway sets it from the session and overwrites
   * whatever arrives. Requiring it meant every client had to send a value that
   * was then discarded, and the clients that forgot simply could not create
   * anything. Identity belongs to the session, never the body.
   */
  @ApiPropertyOptional({ description: 'Set from the session by the gateway' })
  @IsOptional()
  @IsUUID()
  profileId?: string;

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
