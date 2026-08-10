import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { ArrayContains, IsNull, Not } from 'typeorm';
import { ProjectService } from './project.service';
import { Project } from '../entities/project.entity';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
});

describe('ProjectService', () => {
  let service: ProjectService;
  let repo: ReturnType<typeof mockRepo>;

  const OWNER = 'owner-profile-id';
  const MEMBER = 'member-profile-id';
  const OUTSIDER = 'outsider-profile-id';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: getRepositoryToken(Project), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
    repo = module.get(getRepositoryToken(Project));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('excludes soft-deleted projects from normal authorized reads', async () => {
      repo.find.mockResolvedValue([]);

      await service.findAll({} as never, OWNER);

      const where = repo.find.mock.calls[0][0].where;
      expect(where).toHaveLength(2);
      expect(where).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ owner: OWNER, deletedAt: IsNull() }),
          expect.objectContaining({
            members: ArrayContains([OWNER]),
            deletedAt: IsNull(),
          }),
        ])
      );
    });

    it('returns only soft-deleted projects when explicitly requested without widening authorization', async () => {
      repo.find.mockResolvedValue([]);

      await service.findAll({ deleted: true, owner: OUTSIDER } as never, OWNER);

      const where = repo.find.mock.calls[0][0].where;
      expect(where).toHaveLength(2);
      expect(where).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ owner: OWNER, deletedAt: Not(IsNull()) }),
          expect.objectContaining({
            members: ArrayContains([OWNER]),
            deletedAt: Not(IsNull()),
          }),
        ])
      );
    });

    it('scopes results to projects the caller owns or is a member of', async () => {
      const owned = [{ id: 'p1', owner: OWNER, members: [] }];
      repo.find.mockResolvedValue(owned);

      const result = await service.findAll({} as never, OWNER);

      expect(result).toBe(owned);
      const where = repo.find.mock.calls[0][0].where;
      expect(Array.isArray(where)).toBe(true);
      expect(where[0]).toMatchObject({ owner: OWNER });
      expect(where[1]).toMatchObject({ members: ArrayContains([OWNER]) });
    });

    it('an empty query does NOT return other users projects', async () => {
      // The repository is only ever asked for the caller's projects.
      repo.find.mockResolvedValue([]);

      const result = await service.findAll({} as never, OWNER);

      expect(result).toEqual([]);
      const where = repo.find.mock.calls[0][0].where;
      // Every OR branch is constrained to the requesting user.
      expect(
        where.every(
          (branch: Record<string, unknown>) =>
            branch.owner === OWNER || 'members' in branch
        )
      ).toBe(true);
    });

    it('does not let a client-supplied owner filter widen the scope', async () => {
      repo.find.mockResolvedValue([]);

      // Caller asks for OUTSIDER's projects but is only OWNER.
      await service.findAll({ owner: OUTSIDER } as never, OWNER);

      const where = repo.find.mock.calls[0][0].where;
      // The owner branch is forced back to the requesting user.
      expect(where[0].owner).toBe(OWNER);
    });

    it('runs an unscoped query for trusted internal calls (no requesting user)', async () => {
      repo.find.mockResolvedValue([]);

      await service.findAll({ owner: OUTSIDER } as never);

      const arg = repo.find.mock.calls[0][0];
      expect(Array.isArray(arg.where)).toBe(false);
      expect(arg.where).toMatchObject({ owner: OUTSIDER });
    });
  });

  describe('findOne', () => {
    it('returns the project for its owner', async () => {
      const project = { id: 'p1', owner: OWNER, members: [] };
      repo.findOne.mockResolvedValue(project);

      await expect(service.findOne('p1', OWNER)).resolves.toBe(project);
      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'p1', deletedAt: IsNull() }),
        })
      );
    });

    it('allows a member to read', async () => {
      const project = { id: 'p1', owner: OWNER, members: [MEMBER] };
      repo.findOne.mockResolvedValue(project);

      await expect(service.findOne('p1', MEMBER)).resolves.toBe(project);
    });

    it('denies a non-owner / non-member', async () => {
      repo.findOne.mockResolvedValue({ id: 'p1', owner: OWNER, members: [] });

      await expect(service.findOne('p1', OUTSIDER)).rejects.toBeInstanceOf(
        RpcException
      );
    });
  });

  describe('update', () => {
    it('treats a soft-deleted project as not found and does not persist an update', async () => {
      const deletedProject = {
        id: 'p1',
        owner: OWNER,
        members: [],
        deletedAt: new Date(),
      };
      repo.findOne.mockImplementation(
        ({ where }: { where: Record<string, unknown> }) =>
          where.deletedAt ? null : deletedProject
      );

      await expect(
        service.update('p1', { id: 'p1', name: 'x' } as never, OWNER)
      ).rejects.toBeInstanceOf(RpcException);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: expect.objectContaining({ id: 'p1', deletedAt: IsNull() }),
      });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('denies a non-owner and does not write', async () => {
      repo.findOne.mockResolvedValue({ id: 'p1', owner: OWNER, members: [] });

      await expect(
        service.update('p1', { id: 'p1', name: 'x' } as never, OUTSIDER)
      ).rejects.toBeInstanceOf(RpcException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('rejects a member attempt to change the owner or membership', async () => {
      repo.findOne.mockResolvedValue({
        id: 'p1',
        owner: OWNER,
        members: [MEMBER],
      });

      await expect(
        service.update(
          'p1',
          {
            id: 'p1',
            owner: MEMBER,
            members: [],
            name: 'x',
          } as never,
          MEMBER
        )
      ).rejects.toBeInstanceOf(RpcException);

      expect(repo.update).not.toHaveBeenCalled();
    });

    it('returns the refreshed project after an owner update', async () => {
      const existingProject = { id: 'p1', owner: OWNER, members: [] };
      const refreshedProject = {
        ...existingProject,
        name: 'x',
        updatedAt: new Date(),
      };
      repo.findOne.mockResolvedValueOnce(existingProject);
      repo.findOneBy.mockResolvedValueOnce(refreshedProject);
      repo.update.mockResolvedValue({ affected: 1 });

      await expect(
        service.update('p1', { id: 'p1', name: 'x' } as never, OWNER)
      ).resolves.toBe(refreshedProject);

      expect(repo.update).toHaveBeenCalled();
      expect(repo.findOne).toHaveBeenCalledTimes(1);
      expect(repo.findOneBy).toHaveBeenCalledWith({
        id: 'p1',
        deletedAt: IsNull(),
      });
    });

    it('returns only a scalar refreshed row to an already-authorized member after membership changes', async () => {
      const beforeUpdate = { id: 'p1', owner: OWNER, members: [MEMBER] };
      const refreshedProject = {
        ...beforeUpdate,
        members: [],
        name: 'x',
        tasks: [{ id: 'secret-task' }],
      };
      repo.findOne.mockResolvedValueOnce(beforeUpdate);
      repo.findOneBy.mockResolvedValueOnce(refreshedProject);
      repo.update.mockResolvedValue({ affected: 1 });

      await expect(
        service.update('p1', { id: 'p1', name: 'x' } as never, MEMBER)
      ).resolves.toEqual(
        expect.not.objectContaining({
          tasks: expect.anything(),
          risks: expect.anything(),
          changes: expect.anything(),
          journalEntries: expect.anything(),
        })
      );
      expect(repo.findOneBy).toHaveBeenCalledWith({
        id: 'p1',
        deletedAt: IsNull(),
      });
    });

    it('writes only ordinary editable fields', async () => {
      const existingProject = { id: 'p1', owner: OWNER, members: [] };
      repo.findOne.mockResolvedValueOnce(existingProject);
      repo.findOneBy.mockResolvedValueOnce({ ...existingProject, name: 'x' });
      repo.update.mockResolvedValue({ affected: 1 });

      await service.update(
        'p1',
        { id: 'p1', name: 'x', createdBy: OUTSIDER } as never,
        OWNER
      );

      expect(repo.update).toHaveBeenCalledWith(
        { id: 'p1', deletedAt: IsNull() },
        expect.not.objectContaining({ id: 'p1', createdBy: OUTSIDER })
      );
    });

    it('rejects a concurrent soft-delete and does not disclose the deleted row', async () => {
      const existingProject = { id: 'p1', owner: OWNER, members: [] };
      repo.findOne.mockResolvedValueOnce(existingProject);
      repo.update.mockResolvedValue({ affected: 0 });

      await expect(
        service.update('p1', { id: 'p1', name: 'x' } as never, OWNER)
      ).rejects.toBeInstanceOf(RpcException);

      expect(repo.findOneBy).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('denies a non-owner and does not soft-delete', async () => {
      repo.findOne.mockResolvedValue({ id: 'p1', owner: OWNER, members: [] });

      await expect(service.remove('p1', OUTSIDER)).rejects.toBeInstanceOf(
        RpcException
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('soft-deletes for the owner', async () => {
      repo.findOne.mockResolvedValue({ id: 'p1', owner: OWNER, members: [] });
      repo.update.mockResolvedValue({ affected: 1 });

      await service.remove('p1', OWNER);

      expect(repo.update).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ deletedAt: expect.any(Date) })
      );
    });
  });
});
