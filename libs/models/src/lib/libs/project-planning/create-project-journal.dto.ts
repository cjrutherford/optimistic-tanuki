import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsOptional,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProjectJournalDto {
  @ApiProperty({
    type: String,
    description: 'Profile ID of the journal author',
  })
  @IsString()
  @IsUUID()
  profileId: string;

  @ApiProperty({
    type: String,
    description: 'Project ID this journal entry belongs to',
  })
  @IsString()
  @IsUUID()
  projectId: string;

  @ApiProperty({ type: String, description: 'Content of the journal entry' })
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  content: string;

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
