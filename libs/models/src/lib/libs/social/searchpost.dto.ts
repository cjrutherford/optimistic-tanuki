import { ApiPropertyOptional } from "@nestjs/swagger";

export class SearchPostDto {
    @ApiPropertyOptional()
    id?: string;

    @ApiPropertyOptional({ description: 'Used as text search of the post title.'})
    title?: string;

    @ApiPropertyOptional({ description: 'Used as text search of the post content.'})
    content?: string;

    @ApiPropertyOptional()
    userId?: string;

    @ApiPropertyOptional({ description: 'Treated as the minimum score of the post (upvotes - downvotes)'})
    votes?: number;

    @ApiPropertyOptional({ description: 'Treated as the minimum number of comments on the post.'})
    comments?: number;

    @ApiPropertyOptional({ description: 'Treated as the minimum number of links on the post.'})
    links?: number;

    @ApiPropertyOptional({ description: 'Treated as the minimum number of attachments on the post.'})
    attachments?: number;

    @ApiPropertyOptional({ description: "Used as text search into the posts comments."})
    commentContent?: string;

    @ApiPropertyOptional({ description: "Used as text search into the posts link urls."})
    linkUrl?: string;

    @ApiPropertyOptional({ description: "Used as text search into the posts attachment urls."})
    attachmentUrl?: string;

    @ApiPropertyOptional({ description: "Used as text search into the posts attachment types."})
    attachmentType?: string;
}

export class SearchPostOptions {
    @ApiPropertyOptional()
    orderBy?: 'createdAt' | 'updatedAt';

    @ApiPropertyOptional()
    orderDirection?: 'asc' | 'desc';

    @ApiPropertyOptional()
    limit?: number;

    @ApiPropertyOptional()
    offset?: number;
}
