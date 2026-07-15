import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { ProjectJournalService } from './project-journal.service';
import { ProjectJournal } from '../entities/project-journal.entity';
import { Project } from '../entities/project.entity';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
});

describe('ProjectJournalService', () => {
  let service: ProjectJournalService;
  let journalRepo: ReturnType<typeof mockRepo>;
  let projectRepo: ReturnType<typeof mockRepo>;

  const OWNER = 'owner-profile-id';
  const OUTSIDER = 'outsider-profile-id';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectJournalService,
        { provide: getRepositoryToken(ProjectJournal), useFactory: mockRepo },
        { provide: getRepositoryToken(Project), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get<ProjectJournalService>(ProjectJournalService);
    journalRepo = module.get(getRepositoryToken(ProjectJournal));
    projectRepo = module.get(getRepositoryToken(Project));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('denies reading a journal entry of an inaccessible project', async () => {
    journalRepo.findOne.mockResolvedValue({
      id: 'j1',
      project: { id: 'p1', owner: OWNER, members: [] },
    });

    await expect(service.findOne('j1', OUTSIDER)).rejects.toBeInstanceOf(
      RpcException
    );
  });

  it('denies updating a journal entry of an inaccessible project', async () => {
    journalRepo.findOne.mockResolvedValue({
      id: 'j1',
      project: { id: 'p1', owner: OWNER, members: [] },
    });

    await expect(
      service.update('j1', { id: 'j1' } as never, OUTSIDER)
    ).rejects.toBeInstanceOf(RpcException);
    expect(journalRepo.update).not.toHaveBeenCalled();
  });

  it('returns nothing from findAll when the caller has no accessible projects', async () => {
    projectRepo.find.mockResolvedValue([]);

    await expect(service.findAll({} as never, OWNER)).resolves.toEqual([]);
    expect(journalRepo.find).not.toHaveBeenCalled();
  });
});
