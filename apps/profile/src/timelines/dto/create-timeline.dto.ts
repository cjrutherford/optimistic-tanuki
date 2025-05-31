import { TimelineEventType } from "@optimistic-tanuki/models";

export class CreateTimelineDto {
    name: string;
    description: string;
    userId: string;
    profileId: string;
    projectId: string;
    goalId: string;
    startDate: string;
    endDate: string;
    isCompleted: boolean;
    isPublished: boolean;
    isDeleted: boolean;
    type: TimelineEventType;
}

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

    setName(name: string): this {
        this.name = name;
        return this;
    }

    setDescription(description: string): this {
        this.description = description;
        return this;
    }

    setUserId(userId: string): this {
        this.userId = userId;
        return this;
    }

    setProfileId(profileId: string): this {
        this.profileId = profileId;
        return this;
    }

    setProjectId(projectId: string): this {
        this.projectId = projectId;
        return this;
    }

    setGoalId(goalId: string): this {
        this.goalId = goalId;
        return this;
    }

    setStartDate(startDate: string): this {
        this.startDate = startDate;
        return this;
    }

    setEndDate(endDate: string): this {
        this.endDate = endDate;
        return this;
    }

    setIsCompleted(isCompleted: boolean): this {
        this.isCompleted = isCompleted;
        return this;
    }

    setIsPublished(isPublished: boolean): this {
        this.isPublished = isPublished;
        return this;
    }

    setIsDeleted(isDeleted: boolean): this {
        this.isDeleted = isDeleted;
        return this;
    }

    setType(type: TimelineEventType): this {
        this.type = type;
        return this;
    }

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
//     .setType(TimeLineEventType.SomeType)
//     .build();