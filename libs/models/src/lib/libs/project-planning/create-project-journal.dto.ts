import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsOptional,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProjectJournalDto {
  /**
   * Who wrote the entry.
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
    description: 'Project ID this journal entry belongs to',
  })
  @IsString()
  @IsUUID()
  projectId!: string;

  @ApiProperty({ type: String, description: 'Content of the journal entry' })
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  content!: string;

  @ApiProperty({
    type: String,
    required: false,
    description: 'Optional analysis or reflection',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  analysis?: string;
}
