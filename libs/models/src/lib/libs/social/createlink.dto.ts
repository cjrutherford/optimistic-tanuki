import { ApiProperty } from '@nestjs/swagger';

export class CreateLinkDto {
    @ApiProperty({ description: 'The URL of the link' })
    url: string;

    @ApiProperty({ description: 'The ID of the post' })
    postId: number;
}
