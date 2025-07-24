import { ApiProperty } from '@nestjs/swagger';

export enum TaskStatus {
    TODO = "TODO",
    IN_PROGRESS = "IN_PROGRESS",
    DONE = "DONE",
    ARCHIVED = "ARCHIVED"
}

export enum TaskPriority {
    LOW = "LOW",
    MEDIUM_LOW = "MEDIUM_LOW",
    MEDIUM = "MEDIUM",
    MEDIUM_HIGH = "MEDIUM_HIGH",
    HIGH = "HIGH"
}

export class CreateTaskDto {
    @ApiProperty({ description: 'Title of the task' })
    title: string;

    @ApiProperty({ description: 'Description of the task' })
    description: string;

    @ApiProperty({ description: 'Status of the task' })
    status: TaskStatus;

    @ApiProperty({ description: 'Priority of the task' })
    priority: TaskPriority;

    @ApiProperty({ description: 'User who created the task' })
    createdBy: string;

    @ApiProperty({ description: 'ID of the related project' })
    projectId: string;
}
