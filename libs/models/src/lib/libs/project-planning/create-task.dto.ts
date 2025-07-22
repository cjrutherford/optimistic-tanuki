import { ApiProperty } from '@nestjs/swagger';

export class CreateTaskDto {
    @ApiProperty({ description: 'Title of the task' })
    title: string;

    @ApiProperty({ description: 'Description of the task' })
    description: string;

    @ApiProperty({ description: 'Status of the task' })
    status: string;

    @ApiProperty({ description: 'User who created the task' })
    createdBy: string;

    @ApiProperty({ description: 'ID of the related project' })
    projectId: string;
}
