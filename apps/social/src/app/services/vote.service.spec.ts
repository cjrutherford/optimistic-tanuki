import { CreateVoteDto, UpdateVoteDto } from '@optimistic-tanuki/models';
import { Test, TestingModule } from '@nestjs/testing';

import { Repository } from 'typeorm';
import { Vote } from '../../entities/vote.entity';
import { VoteService } from './vote.service';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('VoteService', () => {
  let service: VoteService;
  let voteRepo: jest.Mocked<Repository<Vote>>;

  const mockVoteRepo = () => ({
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoteService,
        {
          provide: getRepositoryToken(Vote),
          useFactory: mockVoteRepo,
        },
      ],
    }).compile();

    service = module.get<VoteService>(VoteService);
    voteRepo = module.get(getRepositoryToken(Vote));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a vote', async () => {
    const dto: CreateVoteDto = {
      postId: 'some uuid',
      userId: 'u1',
      profileId: 'p1',
      value: 1,
    };
    const vote = {
      id: 1,
      profileId: 'p1',
      post: { id: 'some uuid' },
      userId: 'u1',
      value: 1,
    } as Vote;
    voteRepo.create.mockReturnValue(vote);
    voteRepo.save.mockResolvedValue(vote);
    const result = await service.create(dto);
    expect(voteRepo.create).toHaveBeenCalledWith({
      userId: 'u1',
      profileId: 'p1',
      value: 1,
      post: { id: 'some uuid' },
    });
    expect(voteRepo.save).toHaveBeenCalledWith(vote);
    expect(result).toBe(vote);
  });

  it('should create a vote without postId', async () => {
    const dto: CreateVoteDto = {
      userId: 'u1',
      profileId: 'p1',
      value: 1,
    } as CreateVoteDto;
    const vote = {
      id: 1,
      userId: 'u1',
      value: 1,
    } as Vote;
    voteRepo.create.mockReturnValue(vote);
    voteRepo.save.mockResolvedValue(vote);
    const result = await service.create(dto);
    expect(voteRepo.create).toHaveBeenCalledWith({
      userId: 'u1',
      profileId: 'p1',
      value: 1,
      post: undefined,
    });
    expect(result).toBe(vote);
  });

  it('should find all votes with options', async () => {
    const votes = [{ id: 1 } as Vote];
    voteRepo.find.mockResolvedValue(votes);
    await service.findAll({ where: { value: 1 } });
    expect(voteRepo.find).toHaveBeenCalledWith({ where: { value: 1 } });
  });

  it('should find one vote', async () => {
    const vote = { id: '1' } as unknown as Vote;
    voteRepo.findOne.mockResolvedValue(vote);
    const result = await service.findOne('1');
    expect(voteRepo.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
    expect(result).toBe(vote);
  });

  it('should find one vote with options', async () => {
    const vote = { id: '1' } as unknown as Vote;
    voteRepo.findOne.mockResolvedValue(vote);
    await service.findOne('1', { relations: ['post'] });
    expect(voteRepo.findOne).toHaveBeenCalledWith({
      where: { id: '1' },
      relations: ['post'],
    });
  });

  it('should update a vote', async () => {
    voteRepo.update.mockResolvedValue(undefined);
    const dto: UpdateVoteDto = { value: -1 };
    await service.update(1 as unknown as string, dto);
    expect(voteRepo.update).toHaveBeenCalledWith(1, dto);
  });

  it('should remove a vote', async () => {
    voteRepo.delete.mockResolvedValue(undefined);
    await service.remove(1 as unknown as string);
    expect(voteRepo.delete).toHaveBeenCalledWith(1);
  });

  describe('castVote', () => {
    it('inserts a new vote when none exists for the post+profile', async () => {
      voteRepo.findOne.mockResolvedValue(null);
      const created = {
        id: 1,
        value: 1,
        userId: 'u1',
        profileId: 'p1',
        post: { id: 'post-1' },
      } as unknown as Vote;
      voteRepo.create.mockReturnValue(created);
      voteRepo.save.mockResolvedValue(created);

      const result = await service.castVote('post-1', 'p1', 'u1', 1);

      expect(voteRepo.findOne).toHaveBeenCalledWith({
        where: { post: { id: 'post-1' }, profileId: 'p1' },
        relations: ['post'],
      });
      expect(voteRepo.create).toHaveBeenCalledWith({
        value: 1,
        userId: 'u1',
        profileId: 'p1',
        post: { id: 'post-1' },
      });
      expect(voteRepo.save).toHaveBeenCalledWith(created);
      expect(result).toEqual({ vote: created, created: true, changed: true });
    });

    it('is idempotent when re-voting with the same value', async () => {
      const existing = {
        id: 1,
        value: 1,
        userId: 'u1',
        profileId: 'p1',
        post: { id: 'post-1' },
      } as unknown as Vote;
      voteRepo.findOne.mockResolvedValue(existing);

      const result = await service.castVote('post-1', 'p1', 'u1', 1);

      expect(voteRepo.save).not.toHaveBeenCalled();
      expect(voteRepo.create).not.toHaveBeenCalled();
      expect(voteRepo.delete).not.toHaveBeenCalled();
      expect(result).toEqual({
        vote: existing,
        created: false,
        changed: false,
      });
    });

    it('updates the existing vote in place when re-voting with a different value', async () => {
      const existing = {
        id: 1,
        value: 1,
        userId: 'u1',
        profileId: 'p1',
        post: { id: 'post-1' },
      } as unknown as Vote;
      voteRepo.findOne.mockResolvedValue(existing);
      voteRepo.save.mockResolvedValue({ ...existing, value: -1 });

      const result = await service.castVote('post-1', 'p1', 'u1', -1);

      expect(voteRepo.create).not.toHaveBeenCalled();
      expect(voteRepo.save).toHaveBeenCalledWith({ ...existing, value: -1 });
      expect(result).toEqual({
        vote: { ...existing, value: -1 },
        created: false,
        changed: true,
      });
    });

    it('deletes the existing vote when value is 0', async () => {
      const existing = {
        id: 1,
        value: 1,
        userId: 'u1',
        profileId: 'p1',
        post: { id: 'post-1' },
      } as unknown as Vote;
      voteRepo.findOne.mockResolvedValue(existing);

      const result = await service.castVote('post-1', 'p1', 'u1', 0);

      expect(voteRepo.delete).toHaveBeenCalledWith(1);
      expect(result).toEqual({ vote: null, created: false, changed: true });
    });

    it('is a no-op when value is 0 and no vote exists', async () => {
      voteRepo.findOne.mockResolvedValue(null);

      const result = await service.castVote('post-1', 'p1', 'u1', 0);

      expect(voteRepo.delete).not.toHaveBeenCalled();
      expect(result).toEqual({ vote: null, created: false, changed: false });
    });

    it('does not collide across different posts for the same profile', async () => {
      voteRepo.findOne.mockResolvedValueOnce(null);
      const createdA = {
        id: 1,
        value: 1,
        userId: 'u1',
        profileId: 'p1',
        post: { id: 'post-a' },
      } as unknown as Vote;
      voteRepo.create.mockReturnValueOnce(createdA);
      voteRepo.save.mockResolvedValueOnce(createdA);
      await service.castVote('post-a', 'p1', 'u1', 1);

      voteRepo.findOne.mockResolvedValueOnce(null);
      const createdB = {
        id: 2,
        value: 1,
        userId: 'u1',
        profileId: 'p1',
        post: { id: 'post-b' },
      } as unknown as Vote;
      voteRepo.create.mockReturnValueOnce(createdB);
      voteRepo.save.mockResolvedValueOnce(createdB);
      const result = await service.castVote('post-b', 'p1', 'u1', 1);

      expect(voteRepo.findOne).toHaveBeenNthCalledWith(1, {
        where: { post: { id: 'post-a' }, profileId: 'p1' },
        relations: ['post'],
      });
      expect(voteRepo.findOne).toHaveBeenNthCalledWith(2, {
        where: { post: { id: 'post-b' }, profileId: 'p1' },
        relations: ['post'],
      });
      expect(result).toEqual({ vote: createdB, created: true, changed: true });
    });
  });

  describe('removeVoteByPostAndProfile', () => {
    it('deletes the vote for the post+profile when present', async () => {
      const existing = { id: 5 } as Vote;
      voteRepo.findOne.mockResolvedValue(existing);

      const result = await service.removeVoteByPostAndProfile('post-1', 'p1');

      expect(voteRepo.findOne).toHaveBeenCalledWith({
        where: { post: { id: 'post-1' }, profileId: 'p1' },
        relations: ['post'],
      });
      expect(voteRepo.delete).toHaveBeenCalledWith(5);
      expect(result).toEqual({ success: true });
    });

    it('is a no-op when no vote exists for the post+profile', async () => {
      voteRepo.findOne.mockResolvedValue(null);

      const result = await service.removeVoteByPostAndProfile('post-1', 'p1');

      expect(voteRepo.delete).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });
});
