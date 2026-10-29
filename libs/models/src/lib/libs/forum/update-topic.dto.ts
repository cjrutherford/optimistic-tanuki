import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsString, IsOptional } from 'class-validator';

export class UpdateTopicDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'The title of the topic', required: false })
  title?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'The description of the topic', required: false })
  description?: string;

  @IsOptional()
  @IsString()
  @IsEnum(['public', 'private'])
  @ApiProperty({ description: 'Visibility of the topic', required: false })
  visibility?: 'public' | 'private';

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ description: 'Whether the topic is pinned', required: false })
  isPinned?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ description: 'Whether the topic is locked', required: false })
  isLocked?: boolean;
}
