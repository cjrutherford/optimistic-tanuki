import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  IsOptional,
} from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ description: 'Content of the comment' })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content!: string;

  @ApiProperty({ description: 'ID of the author', required: false })
  @IsOptional()
  @IsString()
  @IsUUID()
  userId?: string;

  @ApiProperty({ description: 'ID of the post' })
  @IsString()
  @IsUUID()
  postId!: string;

  @ApiProperty({ description: 'ID of the parent comment', required: false })
  @IsOptional()
  @IsString()
  @IsUUID()
  parentId?: string;

  @ApiProperty({ description: 'ID of the profile' })
  @IsString()
  @IsUUID()
  profileId!: string;
}
