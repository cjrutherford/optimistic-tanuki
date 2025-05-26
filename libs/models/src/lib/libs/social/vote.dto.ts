import { ApiProperty } from '@nestjs/swagger';


export class VoteDto {
    @ApiProperty({ description: 'ID of the vote' })
    id: string;

    @ApiProperty({ description: 'ID of the user who cast the vote' })
    userId: string;

    @ApiProperty({ description: 'ID of the profile associated with the vote' })
    profileId: string;

    @ApiProperty({ description: 'ID of the item being voted on' })
    itemId: string;

    @ApiProperty({ description: 'The value of the vote' })
    value: number;

    @ApiProperty({ description: 'Timestamp when the vote was created' })
    createdAt: Date;

    @ApiProperty({ description: 'Timestamp when the vote was last updated' })
    updatedAt: Date;
}