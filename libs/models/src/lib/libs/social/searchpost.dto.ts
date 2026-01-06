import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID, IsString, IsNumber, MaxLength, Min } from 'class-validator';

export class SearchPostDto {
    @ApiPropertyOptional({ description: 'Post ID' })
    @IsOptional()
    @IsUUID()
    id?: string;

    @ApiPropertyOptional({ description: 'Used as text search of the post title.'})
    @IsOptional()
    @IsString()
    @MaxLength(500)
    title?: string;

    @ApiPropertyOptional({ description: 'Used as text search of the post content.'})
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    content?: string;

    @ApiPropertyOptional({ description: 'User ID' })
    @IsOptional()
    @IsUUID()
    userId?: string;

    @ApiPropertyOptional({ description: 'Treated as the minimum score of the post (upvotes - downvotes)'})
    @IsOptional()
    @IsNumber()
    votes?: number;

    @ApiPropertyOptional({ description: 'Treated as the minimum number of comments on the post.'})
    @IsOptional()
    @IsNumber()
    @Min(0)
    comments?: number;

    @ApiPropertyOptional({ description: 'Treated as the minimum number of links on the post.'})
    @IsOptional()
    @IsNumber()
    @Min(0)
    links?: number;

    @ApiPropertyOptional({ description: 'Treated as the minimum number of attachments on the post.'})
    @IsOptional()
    @IsNumber()
    @Min(0)
    attachments?: number;

    @ApiPropertyOptional({ description: "Used as text search into the posts comments."})
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    commentContent?: string;

    @ApiPropertyOptional({ description: "Used as text search into the posts link urls."})
    @IsOptional()
    @IsString()
    @MaxLength(2048)
    linkUrl?: string;

    @ApiPropertyOptional({ description: "Used as text search into the posts attachment urls."})
    @IsOptional()
    @IsString()
    @MaxLength(2048)
    attachmentUrl?: string;

    @ApiPropertyOptional({ description: "Used as text search into the posts attachment types."})
    @IsOptional()
    @IsString()
    @MaxLength(100)
    attachmentType?: string;
}

export class SearchPostOptions {
    @ApiPropertyOptional({ enum: ['createdAt', 'updatedAt'] })
    @IsOptional()
    orderBy?: 'createdAt' | 'updatedAt';

    @ApiPropertyOptional({ enum: ['asc', 'desc'] })
    @IsOptional()
    orderDirection?: 'asc' | 'desc';

    @ApiPropertyOptional({ description: 'Maximum results to return' })
    @IsOptional()
    @IsNumber()
    @Min(1)
    limit?: number;

    @ApiPropertyOptional({ description: 'Number of results to skip' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    offset?: number;
}
