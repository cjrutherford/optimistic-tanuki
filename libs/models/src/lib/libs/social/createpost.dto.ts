import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsArray,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePostDto {
  @ApiProperty({
    description: 'The title of the post',
    example: 'My first post',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title!: string;

  @ApiProperty({ description: 'The content of the post in HTML format' })
  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  content!: string;

  @ApiProperty({ description: 'The ID of the user', required: false })
  @IsOptional()
  @IsString()
  @IsUUID()
  userId?: string;

  @ApiProperty({ description: 'The ID of the profile' })
  @IsString()
  @IsUUID()
  profileId!: string;

  @ApiProperty({
    description: 'Array of attachment IDs',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  attachmentIds?: string[];

  @ApiProperty({
    description: 'App scope for the post',
    required: false,
    example: 'social',
  })
  @IsOptional()
  @IsString()
  appScope?: string;

  @ApiProperty({
    description: 'Community ID for community posts',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  communityId?: string;
}
