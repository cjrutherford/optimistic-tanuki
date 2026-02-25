import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
} from 'class-validator';

export class CreateTopicDto {
  @IsString()
  @ApiProperty({ description: 'The title of the topic' })
  title!: string;

  @IsString()
  @ApiProperty({ description: 'The description of the topic' })
  description!: string;

  @IsUUID()
  @ApiProperty({ description: 'The ID of the user creating the topic' })
  userId?: string;

  @IsUUID()
  @ApiProperty({ description: 'The ID of the profile creating the topic' })
  profileId!: string;

  @IsString()
  @IsEnum(['public', 'private'])
  @IsOptional()
  @ApiProperty({ description: 'Visibility of the topic', required: false })
  visibility?: 'public' | 'private';

  @IsBoolean()
  @IsOptional()
  @ApiProperty({ description: 'Whether the topic is pinned', required: false })
  isPinned?: boolean;

  @IsBoolean()
  @IsOptional()
  @ApiProperty({ description: 'Whether the topic is locked', required: false })
  isLocked?: boolean;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'App scope for the topic',
    required: false,
    example: 'forum',
  })
  appScope?: string;
}
