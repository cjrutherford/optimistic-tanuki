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

  describe('create', () => {
    it('throws when the project does not exist', async () => {
      projectRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({ projectId: 'missing' } as never)
      ).rejects.toThrow('Project with id missing not found');
      expect(journalRepo.save).not.toHaveBeenCalled();
    });

    it('denies creating a journal entry in a project the caller cannot access', async () => {
      projectRepo.findOne.mockResolvedValue({
        id: 'p1',
        owner: OWNER,
        members: [],
      });

      await expect(
        service.create({ projectId: 'p1' } as never, OUTSIDER)
      ).rejects.toBeInstanceOf(RpcException);
      expect(journalRepo.save).not.toHaveBeenCalled();
    });

    it('creates a journal entry associated with the project', async () => {
      const project = { id: 'p1', owner: OWNER, members: [] };
      projectRepo.findOne.mockResolvedValue(project);
      journalRepo.create.mockImplementation((v: unknown) => v);
      journalRepo.save.mockResolvedValue({ id: 'j-new' });

      const result = await service.create(
        { projectId: 'p1', profileId: OWNER } as never,
        OWNER
      );

      expect(journalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ project, updatedBy: OWNER })
      );
      expect(result).toEqual({ id: 'j-new' });
    });
  });

  describe('findAll', () => {
    it('applies flat, date-range and text-search filters', async () => {
      journalRepo.find.mockResolvedValue([]);
      const createdAt: [Date, Date] = [
        new Date('2024-01-01'),
        new Date('2024-02-01'),
      ];

      await service.findAll({
        createdBy: OWNER,
        createdAt,
        content: 'launch',
      } as never);

      const where = journalRepo.find.mock.calls[0][0].where;
      expect(where.createdBy).toBe(OWNER);
      expect(where.createdAt).toBeDefined();
      expect(where.content).toBeDefined();
    });

    it('scopes to a specific accessible project', async () => {
      projectRepo.find.mockResolvedValue([{ id: 'p1' }]);
      journalRepo.find.mockResolvedValue([{ id: 'j1' }]);

      const result = await service.findAll({ projectId: 'p1' } as never, OWNER);

      expect(result).toEqual([{ id: 'j1' }]);
    });

    it('denies filtering by an inaccessible project', async () => {
      projectRepo.find.mockResolvedValue([{ id: 'p1' }]);

      const result = await service.findAll(
        { projectId: 'someone-elses' } as never,
        OWNER
      );

      expect(result).toEqual([]);
      expect(journalRepo.find).not.toHaveBeenCalled();
    });

    it('filters by projectId without a requestingUserId', async () => {
      journalRepo.find.mockResolvedValue([]);

      await service.findAll({ projectId: 'p1' } as never);

      const where = journalRepo.find.mock.calls[0][0].where;
      expect(where.project).toEqual({ id: 'p1' });
    });
  });

  describe('update', () => {
    it('updates without an access check when no user is given', async () => {
      journalRepo.update.mockResolvedValue({ affected: 1 });
      journalRepo.findOne.mockResolvedValue({ id: 'j1' });

      const result = await service.update('j1', {
        id: 'j1',
        content: 'updated',
        projectId: 'p1',
      } as never);

      expect(journalRepo.update).toHaveBeenCalledWith(
        'j1',
        expect.not.objectContaining({ projectId: expect.anything() })
      );
      expect(result).toEqual({ id: 'j1' });
    });

    it('allows an authorized caller to update', async () => {
      journalRepo.findOne
        .mockResolvedValueOnce({
          id: 'j1',
          project: { id: 'p1', owner: OWNER, members: [] },
        })
        .mockResolvedValueOnce({ id: 'j1' });
      journalRepo.update.mockResolvedValue({ affected: 1 });

      await service.update('j1', { id: 'j1' } as never, OWNER);

      expect(journalRepo.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('denies removing a journal entry in an inaccessible project', async () => {
      journalRepo.findOne.mockResolvedValue({
        id: 'j1',
        project: { id: 'p1', owner: OWNER, members: [] },
      });

      await expect(service.remove('j1', OUTSIDER)).rejects.toBeInstanceOf(
        RpcException
      );
      expect(journalRepo.update).not.toHaveBeenCalled();
    });

    it('soft-deletes when authorized', async () => {
      journalRepo.findOne.mockResolvedValue({
        id: 'j1',
        project: { id: 'p1', owner: OWNER, members: [] },
      });
      journalRepo.update.mockResolvedValue({ affected: 1 });

      await service.remove('j1', OWNER);

      expect(journalRepo.update).toHaveBeenCalledWith(
        'j1',
        expect.objectContaining({ deletedAt: expect.any(Date) })
      );
    });

    it('soft-deletes without an access check when no user is given', async () => {
      journalRepo.update.mockResolvedValue({ affected: 1 });

      await service.remove('j1');

      expect(journalRepo.findOne).not.toHaveBeenCalled();
      expect(journalRepo.update).toHaveBeenCalled();
    });
  });
});
