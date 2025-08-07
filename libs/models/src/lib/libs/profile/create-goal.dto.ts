import { ApiProperty } from '@nestjs/swagger';

/**
 * Data transfer object for creating a new goal.
 */
export class CreateGoalDto {
    /**
     * The name of the goal.
     */
    @ApiProperty({ description: 'The name of the goal' })
    name: string;

    /**
     * The description of the goal.
     */
    @ApiProperty({ description: 'The description of the goal' })
    description: string;

    /**
     * The ID of the user creating the goal.
     */
    @ApiProperty({ description: 'The ID of the user creating the goal' })
    userId: string;

    /**
     * The ID of the timeline associated with the goal.
     */
    @ApiProperty({ description: 'The ID of the timeline associated with the goal' })
    timelineId: string;

    /**
     * The ID of the project associated with the goal.
     */
    @ApiProperty({ description: 'The ID of the project associated with the goal' })
    projectId: string;

    /**
     * The ID of the profile associated with the goal.
     */
    @ApiProperty({ description: 'The ID of the profile associated with the goal' })
    profileId: string;
}