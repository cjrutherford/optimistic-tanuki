import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { TaskTimeEntryService } from './task-time-entry.service';
import { TaskTimeEntry } from '../entities/task-time-entry.entity';
import { Task } from '../entities/task.entity';
import { Project } from '../entities/project.entity';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
});

describe('TaskTimeEntryService', () => {
  let service: TaskTimeEntryService;
  let entryRepo: ReturnType<typeof mockRepo>;
  let taskRepo: ReturnType<typeof mockRepo>;
  let projectRepo: ReturnType<typeof mockRepo>;

  const OWNER = 'owner-profile-id';
  const MEMBER = 'member-profile-id';
  const OUTSIDER = 'outsider-profile-id';

  const project = { id: 'p1', owner: OWNER, members: [MEMBER] };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskTimeEntryService,
        { provide: getRepositoryToken(TaskTimeEntry), useFactory: mockRepo },
        { provide: getRepositoryToken(Task), useFactory: mockRepo },
        { provide: getRepositoryToken(Project), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get<TaskTimeEntryService>(TaskTimeEntryService);
    entryRepo = module.get(getRepositoryToken(TaskTimeEntry));
    taskRepo = module.get(getRepositoryToken(Task));
    projectRepo = module.get(getRepositoryToken(Project));

    entryRepo.find.mockResolvedValue([]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('throws 404 when the parent task does not exist', async () => {
      taskRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({ taskId: 't1' } as never, OWNER)
      ).rejects.toBeInstanceOf(RpcException);
      expect(entryRepo.save).not.toHaveBeenCalled();
    });

    it('allows the project owner to create a time entry', async () => {
      taskRepo.findOne.mockResolvedValue({ id: 't1', project });
      entryRepo.create.mockReturnValue({ id: 'e1' });
      entryRepo.save.mockResolvedValue({ id: 'e1' });

      await service.create({ taskId: 't1', createdBy: OWNER } as never, OWNER);

      expect(entryRepo.save).toHaveBeenCalled();
    });

    it('allows a project member to create a time entry', async () => {
      taskRepo.findOne.mockResolvedValue({ id: 't1', project });
      entryRepo.create.mockReturnValue({ id: 'e1' });
      entryRepo.save.mockResolvedValue({ id: 'e1' });

      await service.create(
        { taskId: 't1', createdBy: MEMBER } as never,
        MEMBER
      );

      expect(entryRepo.save).toHaveBeenCalled();
    });

    it('denies an outsider with a 403 RpcException', async () => {
      taskRepo.findOne.mockResolvedValue({ id: 't1', project });

      await expect(
        service.create({ taskId: 't1', createdBy: OUTSIDER } as never, OUTSIDER)
      ).rejects.toBeInstanceOf(RpcException);
      expect(entryRepo.save).not.toHaveBeenCalled();
    });

    it('stays unscoped for trusted internal calls with no requesting user', async () => {
      taskRepo.findOne.mockResolvedValue({ id: 't1', project });
      entryRepo.create.mockReturnValue({ id: 'e1' });
      entryRepo.save.mockResolvedValue({ id: 'e1' });

      await service.create({ taskId: 't1', createdBy: OUTSIDER } as never);

      expect(entryRepo.save).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('throws 404 when the entry does not exist', async () => {
      entryRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('e1', OWNER)).rejects.toBeInstanceOf(
        RpcException
      );
    });

    it('allows the owner to read', async () => {
      const entry = { id: 'e1', task: { id: 't1', project } };
      entryRepo.findOne.mockResolvedValue(entry);

      await expect(service.findOne('e1', OWNER)).resolves.toBe(entry);
    });

    it('allows a member to read', async () => {
      const entry = { id: 'e1', task: { id: 't1', project } };
      entryRepo.findOne.mockResolvedValue(entry);

      await expect(service.findOne('e1', MEMBER)).resolves.toBe(entry);
    });

    it('denies an outsider with a 403 RpcException', async () => {
      entryRepo.findOne.mockResolvedValue({
        id: 'e1',
        task: { id: 't1', project },
      });

      await expect(service.findOne('e1', OUTSIDER)).rejects.toBeInstanceOf(
        RpcException
      );
    });

    it('stays unscoped for trusted internal calls with no requesting user', async () => {
      const entry = { id: 'e1', task: { id: 't1', project } };
      entryRepo.findOne.mockResolvedValue(entry);

      await expect(service.findOne('e1')).resolves.toBe(entry);
    });
  });

  describe('update', () => {
    it('throws 404 when the entry does not exist', async () => {
      entryRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('e1', { id: 'e1' } as never, OWNER)
      ).rejects.toBeInstanceOf(RpcException);
      expect(entryRepo.update).not.toHaveBeenCalled();
    });

    it('denies an outsider and does not write', async () => {
      entryRepo.findOne.mockResolvedValue({
        id: 'e1',
        task: { id: 't1', project },
      });

      await expect(
        service.update('e1', { id: 'e1', description: 'x' } as never, OUTSIDER)
      ).rejects.toBeInstanceOf(RpcException);
      expect(entryRepo.update).not.toHaveBeenCalled();
    });

    it('allows the owner to update', async () => {
      entryRepo.findOne
        .mockResolvedValueOnce({ id: 'e1', task: { id: 't1', project } })
        .mockResolvedValueOnce({ id: 'e1', description: 'x' });

      await service.update(
        'e1',
        { id: 'e1', description: 'x' } as never,
        OWNER
      );

      expect(entryRepo.update).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('throws 404 when the entry does not exist', async () => {
      entryRepo.findOne.mockResolvedValue(null);

      await expect(service.stop('e1', OWNER, OWNER)).rejects.toBeInstanceOf(
        RpcException
      );
      expect(entryRepo.update).not.toHaveBeenCalled();
    });

    it('denies an outsider and does not write', async () => {
      entryRepo.findOne.mockResolvedValue({
        id: 'e1',
        startTime: new Date(),
        task: { id: 't1', project },
      });

      await expect(
        service.stop('e1', OUTSIDER, OUTSIDER)
      ).rejects.toBeInstanceOf(RpcException);
      expect(entryRepo.update).not.toHaveBeenCalled();
    });

    it('allows the owner to stop', async () => {
      entryRepo.findOne
        .mockResolvedValueOnce({
          id: 'e1',
          startTime: new Date(),
          task: { id: 't1', project },
        })
        .mockResolvedValueOnce({ id: 'e1' });

      await service.stop('e1', OWNER, OWNER);

      expect(entryRepo.update).toHaveBeenCalled();
    });

    it('stays unscoped for trusted internal calls with no requesting user', async () => {
      entryRepo.findOne
        .mockResolvedValueOnce({
          id: 'e1',
          startTime: new Date(),
          task: { id: 't1', project },
        })
        .mockResolvedValueOnce({ id: 'e1' });

      await service.stop('e1', OUTSIDER);

      expect(entryRepo.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws 404 when the entry does not exist', async () => {
      entryRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('e1', OWNER)).rejects.toBeInstanceOf(
        RpcException
      );
      expect(entryRepo.update).not.toHaveBeenCalled();
    });

    it('denies an outsider and does not soft-delete', async () => {
      entryRepo.findOne.mockResolvedValue({
        id: 'e1',
        task: { id: 't1', project },
      });

      await expect(service.remove('e1', OUTSIDER)).rejects.toBeInstanceOf(
        RpcException
      );
      expect(entryRepo.update).not.toHaveBeenCalled();
    });

    it('soft-deletes for the owner', async () => {
      entryRepo.findOne.mockResolvedValue({
        id: 'e1',
        task: { id: 't1', project },
      });
      entryRepo.update.mockResolvedValue({ affected: 1 });

      await service.remove('e1', OWNER);

      expect(entryRepo.update).toHaveBeenCalledWith(
        'e1',
        expect.objectContaining({ deletedAt: expect.any(Date) })
      );
    });
  });

  describe('findAll', () => {
    it('returns nothing when the caller has no accessible projects', async () => {
      projectRepo.find.mockResolvedValue([]);

      await expect(service.findAll({} as never, OWNER)).resolves.toEqual([]);
      expect(entryRepo.find).not.toHaveBeenCalled();
    });

    it('scopes results to entries on tasks within accessible projects', async () => {
      projectRepo.find.mockResolvedValue([{ id: 'p1' }]);
      entryRepo.find.mockResolvedValue([]);

      await service.findAll({} as never, OWNER);

      const where = entryRepo.find.mock.calls[0][0].where;
      expect(where.task.id).toBeUndefined();
      expect(where.task.project.id.value).toEqual(['p1']);
    });

    it('does not let a client-supplied taskId widen scope beyond accessible projects', async () => {
      projectRepo.find.mockResolvedValue([{ id: 'p1' }]);
      entryRepo.find.mockResolvedValue([]);

      await service.findAll({ taskId: 'other-task' } as never, OWNER);

      const where = entryRepo.find.mock.calls[0][0].where;
      expect(where.task.id).toBe('other-task');
      expect(where.task.project.id.value).toEqual(['p1']);
    });

    it('runs an unscoped query for trusted internal calls (no requesting user)', async () => {
      entryRepo.find.mockResolvedValue([]);

      await service.findAll({} as never);

      expect(projectRepo.find).not.toHaveBeenCalled();
      const where = entryRepo.find.mock.calls[0][0].where;
      expect(where.task).toBeUndefined();
    });
  });
});
