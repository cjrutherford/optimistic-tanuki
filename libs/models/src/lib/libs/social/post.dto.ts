import { ApiProperty } from '@nestjs/swagger';

export class PostDto {
    @ApiProperty({ description: 'The unique identifier of the post' })
    id: string;

    @ApiProperty({ description: 'The title of the post' })
    title: string;

    @ApiProperty({ description: 'The content of the post' })
    content: string;

    @ApiProperty({ description: 'The date the post was created' })
    createdAt: Date;

    @ApiProperty({ description: 'The date the post was last updated' })
    updatedAt: Date;

    @ApiProperty({ description: 'The ID of the user who created the post' })
    userId: string;

    @ApiProperty({ description: 'The ID of the profile associated with the post' })
    profileId: string;
}