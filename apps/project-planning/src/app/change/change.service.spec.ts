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

  describe('create', () => {
    it('throws when the project does not exist', async () => {
      projectRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({ projectId: 'missing' } as never)
      ).rejects.toThrow('Project with id missing not found');
      expect(changeRepo.save).not.toHaveBeenCalled();
    });

    it('denies creating a change in a project the caller cannot access', async () => {
      projectRepo.findOne.mockResolvedValue({
        id: 'p1',
        owner: OWNER,
        members: [],
      });

      await expect(
        service.create({ projectId: 'p1' } as never, OUTSIDER)
      ).rejects.toBeInstanceOf(RpcException);
      expect(changeRepo.save).not.toHaveBeenCalled();
    });

    it('creates a change and stamps requestor-derived fields', async () => {
      const project = { id: 'p1', owner: OWNER, members: [] };
      projectRepo.findOne.mockResolvedValue(project);
      changeRepo.create.mockImplementation((v: unknown) => v);
      changeRepo.save.mockResolvedValue({ id: 'c-new' });

      const result = await service.create(
        { projectId: 'p1', requestor: OWNER } as never,
        OWNER
      );

      expect(changeRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          project,
          updatedBy: OWNER,
          approver: OWNER,
          createdBy: OWNER,
        })
      );
      expect(changeRepo.save).toHaveBeenCalled();
      expect(result).toEqual({ id: 'c-new' });
    });
  });

  describe('findAll', () => {
    it('applies flat field and date-range filters', async () => {
      changeRepo.find.mockResolvedValue([]);
      const createdAt: [Date, Date] = [
        new Date('2024-01-01'),
        new Date('2024-02-01'),
      ];

      await service.findAll({
        createdBy: OWNER,
        changeType: 'scope',
        createdAt,
        changeDescription: 'urgent',
      } as never);

      const where = changeRepo.find.mock.calls[0][0].where;
      expect(where.createdBy).toBe(OWNER);
      expect(where.changeType).toBe('scope');
      expect(where.createdAt).toBeDefined();
      expect(where.changeDescription).toBeDefined();
    });

    it('scopes to a specific accessible project', async () => {
      projectRepo.find.mockResolvedValue([{ id: 'p1' }]);
      changeRepo.find.mockResolvedValue([{ id: 'c1' }]);

      const result = await service.findAll({ projectId: 'p1' } as never, OWNER);

      expect(result).toEqual([{ id: 'c1' }]);
      const where = changeRepo.find.mock.calls[0][0].where;
      expect(where.project).toEqual({ id: 'p1' });
    });

    it('denies filtering by an inaccessible project', async () => {
      projectRepo.find.mockResolvedValue([{ id: 'p1' }]);

      const result = await service.findAll(
        { projectId: 'someone-elses' } as never,
        OWNER
      );

      expect(result).toEqual([]);
      expect(changeRepo.find).not.toHaveBeenCalled();
    });

    it('filters by projectId without a requestingUserId', async () => {
      changeRepo.find.mockResolvedValue([]);

      await service.findAll({ projectId: 'p1' } as never);

      const where = changeRepo.find.mock.calls[0][0].where;
      expect(where.project).toEqual({ id: 'p1' });
    });
  });

  describe('findOne', () => {
    it('returns the change without an access check when no user is given', async () => {
      const change = { id: 'c1', project: { id: 'p1' } };
      changeRepo.findOne.mockResolvedValue(change);

      await expect(service.findOne('c1')).resolves.toBe(change);
    });
  });

  describe('update', () => {
    it('updates without an access check when no user is given', async () => {
      changeRepo.update.mockResolvedValue({ affected: 1 });
      changeRepo.findOne.mockResolvedValue({ id: 'c1' });

      const result = await service.update('c1', {
        id: 'c1',
        changeStatus: 'approved',
        requestor: OWNER,
      } as never);

      expect(changeRepo.update).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ status: 'approved', updatedBy: OWNER })
      );
      expect(result).toEqual({ id: 'c1' });
    });

    it('allows an authorized caller to update', async () => {
      changeRepo.findOne
        .mockResolvedValueOnce({
          id: 'c1',
          project: { id: 'p1', owner: OWNER, members: [] },
        })
        .mockResolvedValueOnce({ id: 'c1' });
      changeRepo.update.mockResolvedValue({ affected: 1 });

      await service.update('c1', { id: 'c1' } as never, OWNER);

      expect(changeRepo.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('denies removing a change in an inaccessible project', async () => {
      changeRepo.findOne.mockResolvedValue({
        id: 'c1',
        project: { id: 'p1', owner: OWNER, members: [] },
      });

      await expect(service.remove('c1', OUTSIDER)).rejects.toBeInstanceOf(
        RpcException
      );
      expect(changeRepo.update).not.toHaveBeenCalled();
    });

    it('soft-deletes when authorized', async () => {
      changeRepo.findOne.mockResolvedValue({
        id: 'c1',
        project: { id: 'p1', owner: OWNER, members: [] },
      });
      changeRepo.update.mockResolvedValue({ affected: 1 });

      await service.remove('c1', OWNER);

      expect(changeRepo.update).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ deletedAt: expect.any(Date) })
      );
    });

    it('soft-deletes without an access check when no user is given', async () => {
      changeRepo.update.mockResolvedValue({ affected: 1 });

      await service.remove('c1');

      expect(changeRepo.findOne).not.toHaveBeenCalled();
      expect(changeRepo.update).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ deletedAt: expect.any(Date) })
      );
    });
  });
});
