import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { TaskService } from './task.service';
import { Task } from '../entities/task.entity';
import { Project } from '../entities/project.entity';
import { TaskTag } from '../entities/task-tag.entity';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
});

describe('TaskService', () => {
  let service: TaskService;
  let taskRepo: ReturnType<typeof mockRepo>;
  let projectRepo: ReturnType<typeof mockRepo>;
  let taskTagRepo: ReturnType<typeof mockRepo>;

  const OWNER = 'owner-profile-id';
  const OUTSIDER = 'outsider-profile-id';
  const PROJECT_ID = 'project-1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: getRepositoryToken(Task), useFactory: mockRepo },
        { provide: getRepositoryToken(Project), useFactory: mockRepo },
        { provide: getRepositoryToken(TaskTag), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
    taskRepo = module.get(getRepositoryToken(Task));
    projectRepo = module.get(getRepositoryToken(Project));
    taskTagRepo = module.get(getRepositoryToken(TaskTag));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('scopes tasks to the projects the caller can access', async () => {
      projectRepo.find.mockResolvedValue([{ id: PROJECT_ID }]);
      const tasks = [{ id: 't1' }];
      taskRepo.find.mockResolvedValue(tasks);

      const result = await service.findAll({} as never, OWNER);

      expect(result).toBe(tasks);
      // Scoping query first resolves the caller's accessible projects.
      expect(projectRepo.find).toHaveBeenCalled();
      const where = taskRepo.find.mock.calls[0][0].where;
      expect(where.project).toBeDefined();
    });

    it('returns nothing when the caller has no accessible projects', async () => {
      projectRepo.find.mockResolvedValue([]);

      const result = await service.findAll({} as never, OWNER);

      expect(result).toEqual([]);
      expect(taskRepo.find).not.toHaveBeenCalled();
    });

    it('denies filtering by a project the caller cannot access', async () => {
      projectRepo.find.mockResolvedValue([{ id: PROJECT_ID }]);

      const result = await service.findAll(
        { projectId: 'someone-elses-project' } as never,
        OWNER
      );

      expect(result).toEqual([]);
      expect(taskRepo.find).not.toHaveBeenCalled();
    });

    it('scopes to a specific accessible project when requested', async () => {
      projectRepo.find.mockResolvedValue([{ id: PROJECT_ID }]);
      taskRepo.find.mockResolvedValue([{ id: 't1' }]);

      const result = await service.findAll(
        { projectId: PROJECT_ID } as never,
        OWNER
      );

      expect(result).toEqual([{ id: 't1' }]);
      const where = taskRepo.find.mock.calls[0][0].where;
      expect(where.project).toEqual({ id: PROJECT_ID });
    });

    it('filters by projectId without a requestingUserId', async () => {
      taskRepo.find.mockResolvedValue([]);

      await service.findAll({ projectId: PROJECT_ID } as never);

      const where = taskRepo.find.mock.calls[0][0].where;
      expect(where.project).toEqual({ id: PROJECT_ID });
    });

    it('applies title, description and other flat filters', async () => {
      taskRepo.find.mockResolvedValue([]);
      const createdAt: [Date, Date] = [
        new Date('2024-01-01'),
        new Date('2024-02-01'),
      ];
      const updatedAt: [Date, Date] = [
        new Date('2024-01-01'),
        new Date('2024-02-01'),
      ];

      await service.findAll({
        title: 'launch',
        description: 'rollout',
        status: 'open',
        priority: 'high',
        createdBy: OWNER,
        updatedBy: OWNER,
        createdAt,
        updatedAt,
        deleted: true,
      } as never);

      const where = taskRepo.find.mock.calls[0][0].where;
      expect(where.title).toBeDefined();
      expect(where.description).toBeDefined();
      expect(where.status).toBe('open');
      expect(where.priority).toBe('high');
      expect(where.createdBy).toBe(OWNER);
      expect(where.updatedBy).toBe(OWNER);
      expect(where.createdAt).toBeDefined();
      expect(where.updatedAt).toBeDefined();
      expect(where.deletedAt).toBeDefined();
    });

    it('filters the resolved tasks by tagIds', async () => {
      const tasks = [
        { id: 't1', tags: [{ id: 'tag-1' }] },
        { id: 't2', tags: [{ id: 'tag-2' }] },
      ];
      taskRepo.find.mockResolvedValue(tasks);

      const result = await service.findAll({ tagIds: ['tag-1'] } as never);

      expect(result).toEqual([tasks[0]]);
    });
  });

  describe('findOne', () => {
    it('returns the task for a caller with project access', async () => {
      const task = {
        id: 't1',
        project: { id: PROJECT_ID, owner: OWNER, members: [] },
      };
      taskRepo.findOne.mockResolvedValue(task);

      await expect(service.findOne('t1', OWNER)).resolves.toBe(task);
    });

    it('denies a caller without access to the parent project', async () => {
      taskRepo.findOne.mockResolvedValue({
        id: 't1',
        project: { id: PROJECT_ID, owner: OWNER, members: [] },
      });

      await expect(service.findOne('t1', OUTSIDER)).rejects.toBeInstanceOf(
        RpcException
      );
    });
  });

  describe('update', () => {
    it('denies a caller without access to the parent project', async () => {
      taskRepo.findOne.mockResolvedValue({
        id: 't1',
        project: { id: PROJECT_ID, owner: OWNER, members: [] },
      });

      await expect(
        service.update('t1', { id: 't1', title: 'x' } as never, OUTSIDER)
      ).rejects.toBeInstanceOf(RpcException);
      expect(taskRepo.save).not.toHaveBeenCalled();
    });

    it('allows a caller with access to update', async () => {
      const task = {
        id: 't1',
        title: 'old',
        project: { id: PROJECT_ID, owner: OWNER, members: [] },
      };
      taskRepo.findOne.mockResolvedValue(task);
      taskRepo.save.mockResolvedValue(task);

      await service.update('t1', { id: 't1', title: 'x' } as never, OWNER);

      expect(taskRepo.save).toHaveBeenCalled();
    });

    it('throws when the task does not exist', async () => {
      taskRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('missing', { id: 'missing' } as never)
      ).rejects.toThrow('Task not found');
      expect(taskRepo.save).not.toHaveBeenCalled();
    });

    it('resolves new tags when tagIds are provided', async () => {
      const task = {
        id: 't1',
        title: 'old',
        tags: [] as { id: string }[],
        project: { id: PROJECT_ID, owner: OWNER, members: [] },
      };
      taskRepo.findOne.mockResolvedValue(task);
      const newTags = [{ id: 'tag-2' }];
      taskTagRepo.find.mockResolvedValue(newTags);
      taskRepo.save.mockResolvedValue(task);

      await service.update('t1', { id: 't1', tagIds: ['tag-2'] } as never);

      expect(taskTagRepo.find).toHaveBeenCalled();
      expect(task.tags).toEqual(newTags);
    });

    it('clears tags when an empty tagIds array is provided', async () => {
      const task = {
        id: 't1',
        title: 'old',
        tags: [{ id: 'tag-1' }],
        project: { id: PROJECT_ID, owner: OWNER, members: [] },
      };
      taskRepo.findOne.mockResolvedValue(task);
      taskRepo.save.mockResolvedValue(task);

      await service.update('t1', { id: 't1', tagIds: [] } as never);

      expect(task.tags).toEqual([]);
    });

    it('updates description, status, priority and updatedBy fields', async () => {
      const task = {
        id: 't1',
        title: 'old',
        project: { id: PROJECT_ID, owner: OWNER, members: [] },
      };
      taskRepo.findOne.mockResolvedValue(task);
      taskRepo.save.mockResolvedValue(task);

      await service.update('t1', {
        id: 't1',
        description: 'new-description',
        status: 'closed',
        priority: 'low',
        updatedBy: OWNER,
      } as never);

      expect(task).toEqual(
        expect.objectContaining({
          description: 'new-description',
          status: 'closed',
          priority: 'low',
          updatedBy: OWNER,
        })
      );
    });
  });

  describe('remove', () => {
    it('denies a caller without access to the parent project', async () => {
      taskRepo.findOne.mockResolvedValue({
        id: 't1',
        project: { id: PROJECT_ID, owner: OWNER, members: [] },
      });

      await expect(service.remove('t1', OUTSIDER)).rejects.toBeInstanceOf(
        RpcException
      );
      expect(taskRepo.update).not.toHaveBeenCalled();
    });

    it('soft-deletes for a caller with access', async () => {
      taskRepo.findOne.mockResolvedValue({
        id: 't1',
        project: { id: PROJECT_ID, owner: OWNER, members: [] },
      });
      taskRepo.update.mockResolvedValue({ affected: 1 });

      await service.remove('t1', OWNER);

      expect(taskRepo.update).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ deletedAt: expect.any(Date) })
      );
    });

    it('soft-deletes without an access check when no user is given', async () => {
      taskRepo.update.mockResolvedValue({ affected: 1 });

      await service.remove('t1');

      expect(taskRepo.findOne).not.toHaveBeenCalled();
      expect(taskRepo.update).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ deletedAt: expect.any(Date) })
      );
    });
  });

  describe('create', () => {
    it('throws when the project does not exist', async () => {
      projectRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({ projectId: 'missing' } as never)
      ).rejects.toThrow('Project not found');
      expect(taskRepo.save).not.toHaveBeenCalled();
    });

    it('resolves tag entities when tagIds are provided', async () => {
      projectRepo.findOne.mockResolvedValue({
        id: PROJECT_ID,
        owner: OWNER,
        members: [],
      });
      const tags = [{ id: 'tag-1' }];
      taskTagRepo.find.mockResolvedValue(tags);
      taskRepo.create.mockImplementation((v: unknown) => v);
      taskRepo.save.mockResolvedValue({ id: 't-new' });

      await service.create(
        {
          projectId: PROJECT_ID,
          title: 'x',
          tagIds: ['tag-1'],
        } as never,
        OWNER
      );

      expect(taskTagRepo.find).toHaveBeenCalled();
      expect(taskRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tags })
      );
    });

    it('denies creating a task in a project the caller cannot access', async () => {
      projectRepo.findOne.mockResolvedValue({
        id: PROJECT_ID,
        owner: OWNER,
        members: [],
      });

      await expect(
        service.create({ projectId: PROJECT_ID } as never, OUTSIDER)
      ).rejects.toBeInstanceOf(RpcException);
      expect(taskRepo.save).not.toHaveBeenCalled();
    });

    it('allows creating a task in an accessible project', async () => {
      projectRepo.findOne.mockResolvedValue({
        id: PROJECT_ID,
        owner: OWNER,
        members: [],
      });
      taskRepo.create.mockImplementation((v: unknown) => v);
      taskRepo.save.mockResolvedValue({ id: 't-new' });

      await service.create(
        {
          projectId: PROJECT_ID,
          title: 'x',
          description: 'y',
          createdBy: OWNER,
        } as never,
        OWNER
      );

      expect(taskRepo.save).toHaveBeenCalled();
    });
  });
});
