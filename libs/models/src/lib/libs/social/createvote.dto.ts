import { ApiProperty } from '@nestjs/swagger';

export class CreateVoteDto {
    @ApiProperty({ description: 'The value of the vote' })
    value: number;

    @ApiProperty({ description: 'The ID of the user' })
    userId: string;

    @ApiProperty({ description: 'The ID of the post' })
    postId: string;
}
