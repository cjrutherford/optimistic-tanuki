import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { ChangeService } from './change.service';
import { Change } from '../entities/change.entity';
import { Project } from '../entities/project.entity';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
});

describe('ChangeService', () => {
  let service: ChangeService;
  let changeRepo: ReturnType<typeof mockRepo>;
  let projectRepo: ReturnType<typeof mockRepo>;

  const OWNER = 'owner-profile-id';
  const OUTSIDER = 'outsider-profile-id';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangeService,
        { provide: getRepositoryToken(Change), useFactory: mockRepo },
        { provide: getRepositoryToken(Project), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get<ChangeService>(ChangeService);
    changeRepo = module.get(getRepositoryToken(Change));
    projectRepo = module.get(getRepositoryToken(Project));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('denies reading a change of an inaccessible project', async () => {
    changeRepo.findOne.mockResolvedValue({
      id: 'c1',
      project: { id: 'p1', owner: OWNER, members: [] },
    });

    await expect(service.findOne('c1', OUTSIDER)).rejects.toBeInstanceOf(
      RpcException
    );
  });

  it('denies updating a change of an inaccessible project', async () => {
    changeRepo.findOne.mockResolvedValue({
      id: 'c1',
      project: { id: 'p1', owner: OWNER, members: [] },
    });

    await expect(
      service.update('c1', { id: 'c1' } as never, OUTSIDER)
    ).rejects.toBeInstanceOf(RpcException);
    expect(changeRepo.update).not.toHaveBeenCalled();
  });

  it('returns nothing from findAll when the caller has no accessible projects', async () => {
    projectRepo.find.mockResolvedValue([]);

    await expect(service.findAll({} as never, OWNER)).resolves.toEqual([]);
    expect(changeRepo.find).not.toHaveBeenCalled();
  });
});
