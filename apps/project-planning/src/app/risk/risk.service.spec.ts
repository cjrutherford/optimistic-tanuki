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

  describe('create', () => {
    it('throws when the project does not exist', async () => {
      projectRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({ projectId: 'missing' } as never)
      ).rejects.toThrow('Project with id missing not found');
      expect(riskRepo.save).not.toHaveBeenCalled();
    });

    it('denies creating a risk in a project the caller cannot access', async () => {
      projectRepo.findOne.mockResolvedValue({
        id: 'p1',
        owner: OWNER,
        members: [],
      });

      await expect(
        service.create({ projectId: 'p1' } as never, OUTSIDER)
      ).rejects.toBeInstanceOf(RpcException);
      expect(riskRepo.save).not.toHaveBeenCalled();
    });

    it('falls back to the risk name when no description is given', async () => {
      const project = { id: 'p1', owner: OWNER, members: [] };
      projectRepo.findOne.mockResolvedValue(project);
      riskRepo.create.mockImplementation((v: unknown) => v);
      riskRepo.save.mockResolvedValue({ id: 'r-new' });

      await service.create(
        { projectId: 'p1', name: 'Fallback name', riskOwner: OWNER } as never,
        OWNER
      );

      expect(riskRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Fallback name', project })
      );
    });

    it('uses the provided description when present', async () => {
      const project = { id: 'p1', owner: OWNER, members: [] };
      projectRepo.findOne.mockResolvedValue(project);
      riskRepo.create.mockImplementation((v: unknown) => v);
      riskRepo.save.mockResolvedValue({ id: 'r-new' });

      await service.create(
        {
          projectId: 'p1',
          description: 'Explicit description',
          name: 'Fallback name',
          riskOwner: OWNER,
        } as never,
        OWNER
      );

      expect(riskRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Explicit description' })
      );
    });
  });

  describe('findAll', () => {
    it('applies flat, date-range and text-search filters', async () => {
      riskRepo.find.mockResolvedValue([]);
      const createdAt: [Date, Date] = [
        new Date('2024-01-01'),
        new Date('2024-02-01'),
      ];

      await service.findAll({
        impact: 'high',
        createdAt,
        description: 'server',
      } as never);

      const where = riskRepo.find.mock.calls[0][0].where;
      expect(where.impact).toBe('high');
      expect(where.createdAt).toBeDefined();
      expect(where.description).toBeDefined();
    });

    it('scopes to a specific accessible project', async () => {
      projectRepo.find.mockResolvedValue([{ id: 'p1' }]);
      riskRepo.find.mockResolvedValue([{ id: 'r1' }]);

      const result = await service.findAll({ projectId: 'p1' } as never, OWNER);

      expect(result).toEqual([{ id: 'r1' }]);
    });

    it('denies filtering by an inaccessible project', async () => {
      projectRepo.find.mockResolvedValue([{ id: 'p1' }]);

      const result = await service.findAll(
        { projectId: 'someone-elses' } as never,
        OWNER
      );

      expect(result).toEqual([]);
      expect(riskRepo.find).not.toHaveBeenCalled();
    });

    it('filters by projectId without a requestingUserId', async () => {
      riskRepo.find.mockResolvedValue([]);

      await service.findAll({ projectId: 'p1' } as never);

      const where = riskRepo.find.mock.calls[0][0].where;
      expect(where.project).toEqual({ id: 'p1' });
    });
  });

  describe('update', () => {
    it('updates without an access check when no user is given', async () => {
      riskRepo.update.mockResolvedValue({ affected: 1 });
      riskRepo.findOne.mockResolvedValue({ id: 'r1' });

      const result = await service.update('r1', {
        id: 'r1',
        status: 'mitigated',
        projectId: 'p1',
      } as never);

      expect(riskRepo.update).toHaveBeenCalled();
      expect(result).toEqual({ id: 'r1' });
    });

    it('allows an authorized caller to update', async () => {
      riskRepo.findOne
        .mockResolvedValueOnce({
          id: 'r1',
          project: { id: 'p1', owner: OWNER, members: [] },
        })
        .mockResolvedValueOnce({ id: 'r1' });
      riskRepo.update.mockResolvedValue({ affected: 1 });

      await service.update('r1', { id: 'r1' } as never, OWNER);

      expect(riskRepo.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('denies removing a risk in an inaccessible project', async () => {
      riskRepo.findOne.mockResolvedValue({
        id: 'r1',
        project: { id: 'p1', owner: OWNER, members: [] },
      });

      await expect(service.remove('r1', OUTSIDER)).rejects.toBeInstanceOf(
        RpcException
      );
      expect(riskRepo.update).not.toHaveBeenCalled();
    });

    it('soft-deletes when authorized', async () => {
      riskRepo.findOne
        .mockResolvedValueOnce({
          id: 'r1',
          project: { id: 'p1', owner: OWNER, members: [] },
        })
        .mockResolvedValueOnce({ id: 'r1', deletedAt: new Date() });
      riskRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.remove('r1', OWNER);

      expect(riskRepo.update).toHaveBeenCalledWith(
        'r1',
        expect.objectContaining({ deletedAt: expect.any(Date) })
      );
      expect(result).toEqual({ id: 'r1', deletedAt: expect.any(Date) });
    });

    it('soft-deletes without an access check when no user is given', async () => {
      riskRepo.update.mockResolvedValue({ affected: 1 });
      riskRepo.findOne.mockResolvedValue({ id: 'r1' });

      await service.remove('r1');

      expect(riskRepo.update).toHaveBeenCalled();
    });
  });
});
