import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { RiskService } from './risk.service';
import { Risk } from '../entities/risk.entity';
import { Project } from '../entities/project.entity';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
});

describe('RiskService', () => {
  let service: RiskService;
  let riskRepo: ReturnType<typeof mockRepo>;
  let projectRepo: ReturnType<typeof mockRepo>;

  const OWNER = 'owner-profile-id';
  const OUTSIDER = 'outsider-profile-id';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskService,
        { provide: getRepositoryToken(Risk), useFactory: mockRepo },
        { provide: getRepositoryToken(Project), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get<RiskService>(RiskService);
    riskRepo = module.get(getRepositoryToken(Risk));
    projectRepo = module.get(getRepositoryToken(Project));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('denies reading a risk of an inaccessible project', async () => {
    riskRepo.findOne.mockResolvedValue({
      id: 'r1',
      project: { id: 'p1', owner: OWNER, members: [] },
    });

    await expect(service.findOne('r1', OUTSIDER)).rejects.toBeInstanceOf(
      RpcException
    );
  });

  it('denies updating a risk of an inaccessible project', async () => {
    riskRepo.findOne.mockResolvedValue({
      id: 'r1',
      project: { id: 'p1', owner: OWNER, members: [] },
    });

    await expect(
      service.update('r1', { id: 'r1' } as never, OUTSIDER)
    ).rejects.toBeInstanceOf(RpcException);
    expect(riskRepo.update).not.toHaveBeenCalled();
  });

  it('returns nothing from findAll when the caller has no accessible projects', async () => {
    projectRepo.find.mockResolvedValue([]);

    await expect(service.findAll({} as never, OWNER)).resolves.toEqual([]);
    expect(riskRepo.find).not.toHaveBeenCalled();
  });
});
