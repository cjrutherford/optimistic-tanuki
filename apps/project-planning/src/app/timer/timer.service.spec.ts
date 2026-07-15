import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { TimerService } from './timer.service';
import { Timer } from '../entities/timer.entity';
import { Task } from '../entities/task.entity';
import { Project } from '../entities/project.entity';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
});

describe('TimerService', () => {
  let service: TimerService;
  let timerRepo: ReturnType<typeof mockRepo>;
  let projectRepo: ReturnType<typeof mockRepo>;

  const OWNER = 'owner-profile-id';
  const OUTSIDER = 'outsider-profile-id';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimerService,
        { provide: getRepositoryToken(Timer), useFactory: mockRepo },
        { provide: getRepositoryToken(Task), useFactory: mockRepo },
        { provide: getRepositoryToken(Project), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get<TimerService>(TimerService);
    timerRepo = module.get(getRepositoryToken(Timer));
    projectRepo = module.get(getRepositoryToken(Project));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('denies reading a timer whose task belongs to an inaccessible project', async () => {
    timerRepo.findOne.mockResolvedValue({
      id: 'tm1',
      task: { id: 't1', project: { id: 'p1', owner: OWNER, members: [] } },
    });

    await expect(service.findOne('tm1', OUTSIDER)).rejects.toBeInstanceOf(
      RpcException
    );
  });

  it('denies updating a timer whose task belongs to an inaccessible project', async () => {
    timerRepo.findOne.mockResolvedValue({
      id: 'tm1',
      task: { id: 't1', project: { id: 'p1', owner: OWNER, members: [] } },
    });

    await expect(
      service.update('tm1', { id: 'tm1' } as never, OUTSIDER)
    ).rejects.toBeInstanceOf(RpcException);
    expect(timerRepo.update).not.toHaveBeenCalled();
  });

  it('returns nothing from findAll when the caller has no accessible projects', async () => {
    projectRepo.find.mockResolvedValue([]);

    await expect(service.findAll(OWNER)).resolves.toEqual([]);
    expect(timerRepo.find).not.toHaveBeenCalled();
  });
});
