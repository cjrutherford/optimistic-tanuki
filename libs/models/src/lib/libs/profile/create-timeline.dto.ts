import { TimelineEventType } from './timeline-event-type';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data transfer object for creating a new timeline entry.
 */
export class CreateTimelineDto {
    /**
     * The name of the timeline.
     */
    @ApiProperty({ description: 'Name of the timeline' })
    name: string;

    /**
     * The description of the timeline.
     */
    @ApiProperty({ description: 'Description of the timeline' })
    description: string;

    /**
     * The ID of the user.
     */
    @ApiProperty({ description: 'ID of the user' })
    userId: string;

    /**
     * The ID of the profile.
     */
    @ApiProperty({ description: 'ID of the profile' })
    profileId: string;

    /**
     * The ID of the project.
     */
    @ApiProperty({ description: 'ID of the project' })
    projectId: string;

    /**
     * The ID of the goal.
     */
    @ApiProperty({ description: 'ID of the goal' })
    goalId: string;

    /**
     * The start date of the timeline.
     */
    @ApiProperty({ description: 'Start date of the timeline', example: '2023-01-01' })
    startDate: string;

    /**
     * The end date of the timeline.
     */
    @ApiProperty({ description: 'End date of the timeline', example: '2023-12-31' })
    endDate: string;

    /**
     * The completion status of the timeline.
     */
    @ApiProperty({ description: 'Completion status of the timeline' })
    isCompleted: boolean;

    /**
     * The publication status of the timeline.
     */
    @ApiProperty({ description: 'Publication status of the timeline' })
    isPublished: boolean;

    /**
     * The deletion status of the timeline.
     */
    @ApiProperty({ description: 'Deletion status of the timeline' })
    isDeleted: boolean;

    /**
     * The type of the timeline event.
     */
    @ApiProperty({ description: 'Type of the timeline event', enum: TimelineEventType })
    type: TimelineEventType;
}

/**
 * Factory class for creating CreateTimelineDto instances.
 */
export class CreateTimelineDtoFactory {
    private name: string;
    private description: string;
    private userId: string;
    private profileId: string;
    private projectId: string;
    private goalId: string;
    private startDate: string;
    private endDate: string;
    private isCompleted: boolean;
    private isPublished: boolean;
    private isDeleted: boolean;
    private type: TimelineEventType;

    /**
     * Sets the name of the timeline.
     * @param name The name of the timeline.
     * @returns The factory instance.
     */
    setName(name: string): this {
        this.name = name;
        return this;
    }

    /**
     * Sets the description of the timeline.
     * @param description The description of the timeline.
     * @returns The factory instance.
     */
    setDescription(description: string): this {
        this.description = description;
        return this;
    }

    /**
     * Sets the user ID associated with the timeline.
     * @param userId The user ID.
     * @returns The factory instance.
     */
    setUserId(userId: string): this {
        this.userId = userId;
        return this;
    }

    /**
     * Sets the profile ID associated with the timeline.
     * @param profileId The profile ID.
     * @returns The factory instance.
     */
    setProfileId(profileId: string): this {
        this.profileId = profileId;
        return this;
    }

    /**
     * Sets the project ID associated with the timeline.
     * @param projectId The project ID.
     * @returns The factory instance.
     */
    setProjectId(projectId: string): this {
        this.projectId = projectId;
        return this;
    }

    /**
     * Sets the goal ID associated with the timeline.
     * @param goalId The goal ID.
     * @returns The factory instance.
     */
    setGoalId(goalId: string): this {
        this.goalId = goalId;
        return this;
    }

    /**
     * Sets the start date of the timeline.
     * @param startDate The start date.
     * @returns The factory instance.
     */
    setStartDate(startDate: string): this {
        this.startDate = startDate;
        return this;
    }

    /**
     * Sets the end date of the timeline.
     * @param endDate The end date.
     * @returns The factory instance.
     */
    setEndDate(endDate: string): this {
        this.endDate = endDate;
        return this;
    }

    /**
     * Sets the completion status of the timeline.
     * @param isCompleted The completion status.
     * @returns The factory instance.
     */
    setIsCompleted(isCompleted: boolean): this {
        this.isCompleted = isCompleted;
        return this;
    }

    /**
     * Sets the publication status of the timeline.
     * @param isPublished The publication status.
     * @returns The factory instance.
     */
    setIsPublished(isPublished: boolean): this {
        this.isPublished = isPublished;
        return this;
    }

    /**
     * Sets the deletion status of the timeline.
     * @param isDeleted The deletion status.
     * @returns The factory instance.
     */
    setIsDeleted(isDeleted: boolean): this {
        this.isDeleted = isDeleted;
        return this;
    }

    /**
     * Sets the type of the timeline event.
     * @param type The timeline event type.
     * @returns The factory instance.
     */
    setType(type: TimelineEventType): this {
        this.type = type;
        return this;
    }

    /**
     * Builds and returns a CreateTimelineDto instance.
     * @returns A new CreateTimelineDto instance.
     */
    build(): CreateTimelineDto {
        return {
            name: this.name,
            description: this.description,
            userId: this.userId,
            profileId: this.profileId,
            projectId: this.projectId,
            goalId: this.goalId,
            startDate: this.startDate,
            endDate: this.endDate,
            isCompleted: this.isCompleted,
            isPublished: this.isPublished,
            isDeleted: this.isDeleted,
            type: this.type
        } as CreateTimelineDto;
    }
}

// Usage example:
// const timelineDto = new CreateTimelineDtoFactory()
//     .setName('Timeline Name')
//     .setDescription('Description of the timeline')
//     .setUserId('user-id')
//     .setProfileId('profile-id')
//     .setProjectId('project-id')
//     .setGoalId('goal-id')
//     .setStartDate('2023-01-01')
//     .setEndDate('2023-12-31')
//     .setIsCompleted(false)
//     .setIsPublished(true)
//     .setIsDeleted(false)
//     .setType(TimelineEventType.SomeType)
//     .build();