import { ApiProperty } from '@nestjs/swagger';

export class CommentDto {
    @ApiProperty({ description: 'The unique identifier of the comment' })
    id: string;

    @ApiProperty({ description: 'The content of the comment' })
    content: string;

    @ApiProperty({ description: 'The identifier of the user who made the comment' })
    userId: string;

    @ApiProperty({ description: 'The identifier of the profile associated with the comment' })
    profileId: string;

    @ApiProperty({ description: 'The identifier of the post the comment belongs to' })
    postId: string;

    @ApiProperty({ description: 'The date the comment was created' })
    createdAt: Date;

    @ApiProperty({ description: 'The date the comment was last updated' })
    updatedAt: Date;
}