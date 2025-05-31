import { Test, TestingModule } from '@nestjs/testing';
import { TimelinesController } from './timelines.controller';
import { TimelineService } from '../app/timeline.service';
import { CreateTimelineDto } from './dto/create-timeline.dto';
import { TimelineCommands } from '@optimistic-tanuki/constants';
import { FindManyOptions, FindOneOptions } from 'typeorm';
import { TimelineEventType } from '@optimistic-tanuki/models';

describe('TimelinesController', () => {
  let controller: TimelinesController;
  let service: TimelineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TimelinesController],
      providers: [TimelineService],
    })
      .overrideProvider(TimelineService)
      .useValue({
        create: jest
          .fn()
          .mockImplementation((createTimeline) => createTimeline),
        findAll: jest.fn().mockImplementation((query) => query),
        findOne: jest
          .fn()
          .mockImplementation((id, query) => ({ id, ...query })),
      })
      .compile();

    controller = module.get<TimelinesController>(TimelinesController);
    service = module.get<TimelineService>(TimelineService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a timeline', async () => {
    const createTimelineDto: CreateTimelineDto = { 
      name: 'Test Timeline',
      description: 'Test Description',
      userId: '1',
      projectId: '1',
      profileId: '1',
      goalId: '1',
      startDate: new Date().toString(),
      endDate: new Date().toString(),
      isCompleted: false,
      isPublished: false,
      isDeleted: false,
      type: TimelineEventType.AddedGoal,
    };
    expect(await controller.create(createTimelineDto)).toEqual(
      createTimelineDto
    );
    expect(service.create).toHaveBeenCalledWith(createTimelineDto);
  });

  it('should find all timelines', async () => {
    const query: FindManyOptions<any> = { where: { title: 'Test' } };
    expect(await controller.findAll(query)).toEqual(query);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('should find one timeline', async () => {
    const id = '1';
    const query: FindOneOptions<any> = { where: { title: 'Test' } };
    expect(await controller.findOne(id, query)).toEqual({ id, ...query });
    expect(service.findOne).toHaveBeenCalledWith(id, query);
  });
});
