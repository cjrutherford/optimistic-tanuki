import { Repository, UpdateResult } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Timeline, TimelineEventType } from '../timelines/entities/timeline.entity';

import { TimelineService } from './timeline.service';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('TimelineService', () => {
    let service: TimelineService;
    let repository: Repository<Timeline>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TimelineService,
                {
                    provide: getRepositoryToken(Timeline),
                    useClass: Repository,
                },
            ],
        }).compile();

        service = module.get<TimelineService>(TimelineService);
        repository = module.get<Repository<Timeline>>(getRepositoryToken(Timeline));
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('findAll', () => {
        it('should return an array of timelines', async () => {
            const timelines = [new Timeline(), new Timeline()];
            jest.spyOn(repository, 'find').mockResolvedValue(timelines);
            expect(await service.findAll()).toBe(timelines);
        });
    });

    describe('findOne', () => {
        it('should return a timeline when it exists', async () => {
            const timelineId = '1';
            const timeline = new Timeline();
            timeline.id = timelineId;
            jest.spyOn(repository, 'findOne').mockResolvedValue(timeline);
            expect(await service.findOne(timelineId)).toEqual(timeline);
        });

        it('should return null when the timeline does not exist', async () => {
            const timelineId = '1';
            jest.spyOn(repository, 'findOne').mockResolvedValue(null);
            expect(await service.findOne(timelineId)).toBeNull();
        });
    });

    describe('create', () => {
        it('should save and return the created timeline', async () => {
            const createTimelineDto: import('../timelines/dto/create-timeline.dto').CreateTimelineDto = {
                name: 'Test Timeline',
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
                type: TimelineEventType.Posted,
            };
            const savedTimeline: Timeline = {
                id: '1',
                userId: createTimelineDto.userId,
                title: createTimelineDto.name,
                description: createTimelineDto.description,
                timeStamp: new Date(),
                related_goal: null,
                related_project: null,
                related_profile: null,
                eventType: TimelineEventType.Posted,
            };
            jest.spyOn(repository, 'save').mockResolvedValue(savedTimeline);
            expect(await service.create(createTimelineDto)).toEqual(savedTimeline);
        });
    });

    describe('update', () => {
        it('should update and return the updated timeline', async () => {
            const timelineId = '1';
            const updateTimelineDto: import('../timelines/dto/update-timeline.dto').UpdateTimelineDto = {
                id: timelineId,
                name: 'Updated Timeline',
                description: 'desc',
                userId: 'user1',
                profileId: 'profile1',
                projectId: 'project1',
                goalId: 'goal1',
                startDate: '2023-01-01',
                endDate: '2023-12-31',
                isCompleted: true,
                isPublished: true,
                isDeleted: false,
                type: TimelineEventType.Posted,
            };
            const updatedTimeline: Timeline = {
                id: timelineId,
                userId: updateTimelineDto.userId,
                title: updateTimelineDto.name,
                description: updateTimelineDto.description,
                timeStamp: new Date(),
                related_goal: null,
                related_project: null,
                related_profile: null,
                eventType: TimelineEventType.Posted,
            };
            jest.spyOn(repository, 'update').mockResolvedValue({} as UpdateResult);
            jest.spyOn(repository, 'findOne').mockResolvedValue(updatedTimeline);
            expect(await service.update(timelineId, updateTimelineDto)).toEqual(updatedTimeline);
        });
    });
});