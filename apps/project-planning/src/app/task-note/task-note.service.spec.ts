import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { TaskNoteService } from './task-note.service';
import { TaskNote } from '../entities/task-note.entity';
import { Task } from '../entities/task.entity';
import { Project } from '../entities/project.entity';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
});

describe('TaskNoteService', () => {
  let service: TaskNoteService;
  let taskNoteRepo: ReturnType<typeof mockRepo>;
  let taskRepo: ReturnType<typeof mockRepo>;
  let projectRepo: ReturnType<typeof mockRepo>;

  const OWNER = 'owner-profile-id';
  const MEMBER = 'member-profile-id';
  const OUTSIDER = 'outsider-profile-id';

  const project = { id: 'p1', owner: OWNER, members: [MEMBER] };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskNoteService,
        { provide: getRepositoryToken(TaskNote), useFactory: mockRepo },
        { provide: getRepositoryToken(Task), useFactory: mockRepo },
        { provide: getRepositoryToken(Project), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get<TaskNoteService>(TaskNoteService);
    taskNoteRepo = module.get(getRepositoryToken(TaskNote));
    taskRepo = module.get(getRepositoryToken(Task));
    projectRepo = module.get(getRepositoryToken(Project));
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
      expect(taskNoteRepo.save).not.toHaveBeenCalled();
    });

    it('allows the project owner to create a note', async () => {
      taskRepo.findOne.mockResolvedValue({ id: 't1', project });
      taskNoteRepo.create.mockReturnValue({ id: 'n1' });
      taskNoteRepo.save.mockResolvedValue({ id: 'n1' });

      await service.create(
        { taskId: 't1', profileId: OWNER, content: 'hi' } as never,
        OWNER
      );

      expect(taskNoteRepo.save).toHaveBeenCalled();
    });

    it('allows a project member to create a note', async () => {
      taskRepo.findOne.mockResolvedValue({ id: 't1', project });
      taskNoteRepo.create.mockReturnValue({ id: 'n1' });
      taskNoteRepo.save.mockResolvedValue({ id: 'n1' });

      await service.create(
        { taskId: 't1', profileId: MEMBER, content: 'hi' } as never,
        MEMBER
      );

      expect(taskNoteRepo.save).toHaveBeenCalled();
    });

    it('denies an outsider with a 403 RpcException', async () => {
      taskRepo.findOne.mockResolvedValue({ id: 't1', project });

      await expect(
        service.create(
          { taskId: 't1', profileId: OUTSIDER, content: 'hi' } as never,
          OUTSIDER
        )
      ).rejects.toBeInstanceOf(RpcException);
      expect(taskNoteRepo.save).not.toHaveBeenCalled();
    });

    it('stays unscoped for trusted internal calls with no requesting user', async () => {
      taskRepo.findOne.mockResolvedValue({ id: 't1', project });
      taskNoteRepo.create.mockReturnValue({ id: 'n1' });
      taskNoteRepo.save.mockResolvedValue({ id: 'n1' });

      await service.create({
        taskId: 't1',
        profileId: OUTSIDER,
        content: 'hi',
      } as never);

      expect(taskNoteRepo.save).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('throws 404 when the note does not exist', async () => {
      taskNoteRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('n1', OWNER)).rejects.toBeInstanceOf(
        RpcException
      );
    });

    it('allows the owner to read', async () => {
      const note = { id: 'n1', task: { id: 't1', project } };
      taskNoteRepo.findOne.mockResolvedValue(note);

      await expect(service.findOne('n1', OWNER)).resolves.toBe(note);
    });

    it('allows a member to read', async () => {
      const note = { id: 'n1', task: { id: 't1', project } };
      taskNoteRepo.findOne.mockResolvedValue(note);

      await expect(service.findOne('n1', MEMBER)).resolves.toBe(note);
    });

    it('denies an outsider with a 403 RpcException', async () => {
      taskNoteRepo.findOne.mockResolvedValue({
        id: 'n1',
        task: { id: 't1', project },
      });

      await expect(service.findOne('n1', OUTSIDER)).rejects.toBeInstanceOf(
        RpcException
      );
    });

    it('stays unscoped for trusted internal calls with no requesting user', async () => {
      const note = { id: 'n1', task: { id: 't1', project } };
      taskNoteRepo.findOne.mockResolvedValue(note);

      await expect(service.findOne('n1')).resolves.toBe(note);
    });
  });

  describe('update', () => {
    it('throws 404 when the note does not exist', async () => {
      taskNoteRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('n1', { id: 'n1' } as never, OWNER)
      ).rejects.toBeInstanceOf(RpcException);
      expect(taskNoteRepo.update).not.toHaveBeenCalled();
    });

    it('denies an outsider and does not write', async () => {
      taskNoteRepo.findOne.mockResolvedValue({
        id: 'n1',
        task: { id: 't1', project },
      });

      await expect(
        service.update('n1', { id: 'n1', content: 'x' } as never, OUTSIDER)
      ).rejects.toBeInstanceOf(RpcException);
      expect(taskNoteRepo.update).not.toHaveBeenCalled();
    });

    it('allows the owner to update', async () => {
      taskNoteRepo.findOne
        .mockResolvedValueOnce({ id: 'n1', task: { id: 't1', project } })
        .mockResolvedValueOnce({ id: 'n1', content: 'x' });

      await service.update('n1', { id: 'n1', content: 'x' } as never, OWNER);

      expect(taskNoteRepo.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws 404 when the note does not exist', async () => {
      taskNoteRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('n1', OWNER)).rejects.toBeInstanceOf(
        RpcException
      );
      expect(taskNoteRepo.update).not.toHaveBeenCalled();
    });

    it('denies an outsider and does not soft-delete', async () => {
      taskNoteRepo.findOne.mockResolvedValue({
        id: 'n1',
        task: { id: 't1', project },
      });

      await expect(service.remove('n1', OUTSIDER)).rejects.toBeInstanceOf(
        RpcException
      );
      expect(taskNoteRepo.update).not.toHaveBeenCalled();
    });

    it('soft-deletes for the owner', async () => {
      taskNoteRepo.findOne.mockResolvedValue({
        id: 'n1',
        task: { id: 't1', project },
      });
      taskNoteRepo.update.mockResolvedValue({ affected: 1 });

      await service.remove('n1', OWNER);

      expect(taskNoteRepo.update).toHaveBeenCalledWith(
        'n1',
        expect.objectContaining({ deletedAt: expect.any(Date) })
      );
    });
  });

  describe('findAll', () => {
    it('returns nothing when the caller has no accessible projects', async () => {
      projectRepo.find.mockResolvedValue([]);

      await expect(service.findAll({} as never, OWNER)).resolves.toEqual([]);
      expect(taskNoteRepo.find).not.toHaveBeenCalled();
    });

    it('scopes results to notes on tasks within accessible projects', async () => {
      projectRepo.find.mockResolvedValue([{ id: 'p1' }]);
      taskNoteRepo.find.mockResolvedValue([]);

      await service.findAll({} as never, OWNER);

      const where = taskNoteRepo.find.mock.calls[0][0].where;
      expect(where.task.id).toBeUndefined();
      expect(where.task.project.id.value).toEqual(['p1']);
    });

    it('does not let a client-supplied taskId widen scope beyond accessible projects', async () => {
      projectRepo.find.mockResolvedValue([{ id: 'p1' }]);
      taskNoteRepo.find.mockResolvedValue([]);

      await service.findAll({ taskId: 'other-task' } as never, OWNER);

      const where = taskNoteRepo.find.mock.calls[0][0].where;
      expect(where.task.id).toBe('other-task');
      expect(where.task.project.id.value).toEqual(['p1']);
    });

    it('runs an unscoped query for trusted internal calls (no requesting user)', async () => {
      taskNoteRepo.find.mockResolvedValue([]);

      await service.findAll({} as never);

      expect(projectRepo.find).not.toHaveBeenCalled();
      const where = taskNoteRepo.find.mock.calls[0][0].where;
      expect(where.task).toBeUndefined();
    });
  });
});
