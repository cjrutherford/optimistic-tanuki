import { CreateTimelineDto, CreateTimelineDtoFactory } from './create-timeline.dto';

import { TimelineEventType } from '@optimistic-tanuki/models';

describe('CreateTimelineDto', () => {
  it('should create a DTO with all properties', () => {
    const dto: CreateTimelineDto = {
      name: 'Timeline',
      description: 'desc',
      userId: 'user1',
      profileId: 'profile1',
      projectId: 'project1',
      goalId: 'goal1',
      startDate: '2023-01-01',
      endDate: '2023-12-31',
      isCompleted: false,
      isPublished: true,
      isDeleted: false,
      type: TimelineEventType.AddedGoal
    };
    expect(dto).toBeDefined();
    expect(dto.name).toBe('Timeline');
    expect(dto.type).toBe(TimelineEventType.AddedGoal);
  });

  it('should build a DTO using the factory', () => {
    const dto = new CreateTimelineDtoFactory()
      .setName('Timeline')
      .setDescription('desc')
      .setUserId('user1')
      .setProfileId('profile1')
      .setProjectId('project1')
      .setGoalId('goal1')
      .setStartDate('2023-01-01')
      .setEndDate('2023-12-31')
      .setIsCompleted(true)
      .setIsPublished(false)
      .setIsDeleted(true)
      .setType(TimelineEventType.UpdatedGoal)
      .build();
    expect(dto).toBeDefined();
    expect(dto.name).toBe('Timeline');
    expect(dto.isCompleted).toBe(true);
    expect(dto.isPublished).toBe(false);
    expect(dto.isDeleted).toBe(true);
    expect(dto.type).toBe(TimelineEventType.UpdatedGoal);
  });

  it('should allow partial DTOs and undefined values', () => {
    const dto = new CreateTimelineDtoFactory()
      .setName('Partial')
      .build();
    expect(dto.name).toBe('Partial');
    expect(dto.description).toBeUndefined();
    expect(dto.type).toBeUndefined();
  });
});
