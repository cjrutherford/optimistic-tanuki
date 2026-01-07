import { TimelineEventType } from './timeline-event-type';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsBoolean, IsEnum, IsDateString, MaxLength, MinLength } from 'class-validator';

export class CreateTimelineDto {
  @ApiProperty({ description: 'Name of the timeline', example: 'Q1 2026 Roadmap' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @ApiProperty({ description: 'Description of the timeline', example: 'Key deliverables for first quarter' })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description: string;

  @ApiProperty({ description: 'ID of the user' })
  @IsString()
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'ID of the profile' })
  @IsString()
  @IsUUID()
  profileId: string;

  @ApiProperty({ description: 'ID of the project' })
  @IsString()
  @IsUUID()
  projectId: string;

  @ApiProperty({ description: 'ID of the goal' })
  @IsString()
  @IsUUID()
  goalId: string;

  @ApiProperty({
    description: 'Start date of the timeline',
    example: '2023-01-01',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'End date of the timeline',
    example: '2023-12-31',
  })
  @IsDateString()
  endDate: string;

  @ApiProperty({ description: 'Completion status of the timeline' })
  @IsBoolean()
  isCompleted: boolean;

  @ApiProperty({ description: 'Publication status of the timeline' })
  @IsBoolean()
  isPublished: boolean;

  @ApiProperty({ description: 'Deletion status of the timeline' })
  @IsBoolean()
  isDeleted: boolean;

  @ApiProperty({
    description: 'Type of the timeline event',
    enum: TimelineEventType,
  })
  @IsEnum(TimelineEventType)
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
      type: this.type,
    } as CreateTimelineDto;
  }
}

// Example usage removed — refer to git history for prior examples if needed.
