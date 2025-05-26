import { ApiPropertyOptional } from "@nestjs/swagger";

export class SearchCommentDto {
    @ApiPropertyOptional()
    id?: string;

    @ApiPropertyOptional({ description: 'Used as text search of the comment content.'})
    content?: string;

    @ApiPropertyOptional()
    userId?: string;

    @ApiPropertyOptional()
    profileId?: string;

    @ApiPropertyOptional()
    postId?: string;

    @ApiPropertyOptional({ description: 'Treated as the minimum score of the comment (upvotes - downvotes)'})
    votes?: number;

    @ApiPropertyOptional({ description: 'Treated as the minimum number of replies on the comment.'})
    replies?: number;

    @ApiPropertyOptional({ description: 'Used as text search into the comments replies.'})
    replyContent?: string;

    @ApiPropertyOptional({ description: 'Used as text search into the comments attachments.'})
    attachmentUrl?: string;

    @ApiPropertyOptional({ description: 'Used as text search into the comments attachment types.'})
    attachmentType?: string;

    @ApiPropertyOptional({ description: 'Parent Comment ID'})
    parentId?: string;

}