import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsString } from 'class-validator';

export class UpdateTopicDto {
  @IsString()
  @ApiProperty({ description: 'The title of the topic', required: false })
  title?: string;

  @IsString()
  @ApiProperty({ description: 'The description of the topic', required: false })
  description?: string;

  @IsString()
  @IsEnum(['public', 'private'])
  @ApiProperty({ description: 'Visibility of the topic', required: false })
  visibility?: 'public' | 'private';

  @IsBoolean()
  @ApiProperty({ description: 'Whether the topic is pinned', required: false })
  isPinned?: boolean;

  @IsBoolean()
  @ApiProperty({ description: 'Whether the topic is locked', required: false })
  isLocked?: boolean;
}
