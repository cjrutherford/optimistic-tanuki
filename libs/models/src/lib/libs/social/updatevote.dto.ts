import { ApiProperty } from '@nestjs/swagger';

export class UpdateVoteDto {
    @ApiProperty({ description: 'The value of the vote' })
    value: number;
}
