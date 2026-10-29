import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateThreadDto {
  @ApiProperty({ description: 'The title of the thread', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'The content of the thread', required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ description: 'Visibility of the thread', required: false })
  @IsOptional()
  @IsIn(['public', 'private'])
  visibility?: 'public' | 'private';

  @ApiProperty({ description: 'Whether the thread is pinned', required: false })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiProperty({ description: 'Whether the thread is locked', required: false })
  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;
}
