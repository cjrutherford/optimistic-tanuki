import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsUUID,
  IsString,
  IsNumber,
  MaxLength,
  Min,
} from 'class-validator';

export class SearchCommentDto {
  @ApiPropertyOptional({ description: 'Comment ID' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({
    description: 'Used as text search of the comment content.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;

  @ApiPropertyOptional({ description: 'User ID' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Profile ID' })
  @IsOptional()
  @IsUUID()
  profileId?: string;

  @ApiPropertyOptional({ description: 'Post ID' })
  @IsOptional()
  @IsUUID()
  postId?: string;

  @ApiPropertyOptional({
    description:
      'Treated as the minimum score of the comment (upvotes - downvotes)',
  })
  @IsOptional()
  @IsNumber()
  votes?: number;

  @ApiPropertyOptional({
    description: 'Treated as the minimum number of replies on the comment.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  replies?: number;

  @ApiPropertyOptional({
    description: 'Used as text search into the comments replies.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  replyContent?: string;

  @ApiPropertyOptional({
    description: 'Used as text search into the comments attachments.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  attachmentUrl?: string;

  @ApiPropertyOptional({
    description: 'Used as text search into the comments attachment types.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  attachmentType?: string;

  @ApiPropertyOptional({ description: 'Parent Comment ID' })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
