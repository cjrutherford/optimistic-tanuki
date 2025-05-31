import { ApiProperty } from '@nestjs/swagger';

export class CreateProjectDto {
    @ApiProperty({ description: 'The name of the project' })
    name: string;

    @ApiProperty({ description: 'The description of the project' })
    description: string;

    @ApiProperty({ description: 'The ID of the user creating the project' })
    userId: string;

    @ApiProperty({ description: 'The ID of the timeline associated with the project' })
    timelineId: string;

    @ApiProperty({ description: 'The ID of the profile associated with the project' })
    profileId: string;
}
