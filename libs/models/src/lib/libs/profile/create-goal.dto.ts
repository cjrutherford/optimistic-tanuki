import { ApiProperty } from '@nestjs/swagger';

export class CreateGoalDto {
    @ApiProperty({ description: 'The name of the goal' })
    name: string;

    @ApiProperty({ description: 'The description of the goal' })
    description: string;

    @ApiProperty({ description: 'The ID of the user creating the goal' })
    userId: string;

    @ApiProperty({ description: 'The ID of the timeline associated with the goal' })
    timelineId: string;

    @ApiProperty({ description: 'The ID of the project associated with the goal' })
    projectId: string;

    @ApiProperty({ description: 'The ID of the profile associated with the goal' })
    profileId: string;
}