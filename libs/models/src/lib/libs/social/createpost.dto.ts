import { ApiProperty } from '@nestjs/swagger';

export class CreatePostDto {
    @ApiProperty({ description: 'The title of the post' })
    title: string;

    @ApiProperty({ description: 'The content of the post' })
    content: string;

    @ApiProperty({ description: 'The ID of the user' })
    userId: string;

    @ApiProperty({ description: 'The ID of the profile' })
    profileId: string;
}
