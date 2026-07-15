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
  });

  describe('create', () => {
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
