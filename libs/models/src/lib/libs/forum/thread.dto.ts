import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsIn,
  IsBoolean,
  IsISO8601,
  IsInt,
  Min,
} from 'class-validator';

export class ThreadDto {
  @ApiProperty({ description: 'The unique identifier of the thread' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({ description: 'The title of the thread' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ description: 'The description of the thread' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ description: 'The content of the thread' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiProperty({ description: 'The ID of the user who created the thread' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({
    description: 'The ID of the profile associated with the thread',
  })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  profileId!: string;

  @ApiProperty({ description: 'The ID of the topic this thread belongs to' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  topicId!: string;

  @ApiProperty({ description: 'The date the thread was created' })
  @IsISO8601()
  @IsNotEmpty()
  createdAt!: Date;

  @ApiProperty({ description: 'The date the thread was last updated' })
  @IsISO8601()
  @IsNotEmpty()
  updatedAt!: Date;

  @ApiProperty({ description: 'Visibility of the thread' })
  @IsIn(['public', 'private'])
  visibility!: 'public' | 'private';

  @ApiProperty({ description: 'Whether the thread is pinned' })
  @IsBoolean()
  isPinned!: boolean;

  @ApiProperty({ description: 'Whether the thread is locked' })
  @IsBoolean()
  isLocked!: boolean;

  @ApiProperty({ description: 'Number of views' })
  @IsInt()
  @Min(0)
  viewCount!: number;
}
