import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReactionService } from './reaction.service';
import { Reaction } from '../../entities/reaction.entity';

describe('ReactionService', () => {
  let service: ReactionService;
  let reactionRepo: jest.Mocked<Repository<Reaction>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReactionService,
        {
          provide: getRepositoryToken(Reaction),
          useFactory: () => ({
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          }),
        },
      ],
    }).compile();

    service = module.get<ReactionService>(ReactionService);
    reactionRepo = module.get(getRepositoryToken(Reaction));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('links the reaction to a post', async () => {
      const reaction = { id: 'r1' } as Reaction;
      reactionRepo.create.mockReturnValue(reaction);
      reactionRepo.save.mockResolvedValue(reaction);

      const result = await service.create({
        value: 1,
        userId: 'u1',
        profileId: 'p1',
        postId: 'post-1',
      });

      expect(reactionRepo.create).toHaveBeenCalledWith({
        value: 1,
        userId: 'u1',
        profileId: 'p1',
        post: { id: 'post-1' },
        comment: undefined,
      });
      expect(result).toBe(reaction);
    });

    it('links the reaction to a comment', async () => {
      const reaction = { id: 'r2' } as Reaction;
      reactionRepo.create.mockReturnValue(reaction);
      reactionRepo.save.mockResolvedValue(reaction);

      await service.create({
        value: 3,
        userId: 'u1',
        profileId: 'p1',
        commentId: 'comment-1',
      });

      expect(reactionRepo.create).toHaveBeenCalledWith({
        value: 3,
        userId: 'u1',
        profileId: 'p1',
        post: undefined,
        comment: { id: 'comment-1' },
      });
    });
  });

  describe('findAll', () => {
    it('passes options straight through', async () => {
      const reactions = [{ id: 'r1' }] as Reaction[];
      reactionRepo.find.mockResolvedValue(reactions);

      const options = { where: { userId: 'u1' } };
      expect(await service.findAll(options)).toBe(reactions);
      expect(reactionRepo.find).toHaveBeenCalledWith(options);
    });

    it('works with no options', async () => {
      reactionRepo.find.mockResolvedValue([]);

      await service.findAll();

      expect(reactionRepo.find).toHaveBeenCalledWith(undefined);
    });
  });

  describe('findOne', () => {
    it('finds by id', async () => {
      const reaction = { id: 'r1' } as Reaction;
      reactionRepo.findOne.mockResolvedValue(reaction);

      expect(await service.findOne('r1')).toBe(reaction);
      expect(reactionRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'r1' },
      });
    });

    it('merges extra find options', async () => {
      reactionRepo.findOne.mockResolvedValue(null);

      await service.findOne('r1', { relations: ['post'] });

      expect(reactionRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'r1' },
        relations: ['post'],
      });
    });
  });

  describe('findByPostId / findByCommentId', () => {
    it('finds reactions for a post', async () => {
      reactionRepo.find.mockResolvedValue([]);

      await service.findByPostId('post-1');

      expect(reactionRepo.find).toHaveBeenCalledWith({
        where: { post: { id: 'post-1' } },
        relations: ['post'],
      });
    });

    it('finds reactions for a comment', async () => {
      reactionRepo.find.mockResolvedValue([]);

      await service.findByCommentId('comment-1');

      expect(reactionRepo.find).toHaveBeenCalledWith({
        where: { comment: { id: 'comment-1' } },
        relations: ['comment'],
      });
    });
  });

  describe('findUserReaction', () => {
    it('queries by user alone when no target is given', async () => {
      reactionRepo.findOne.mockResolvedValue(null);

      expect(await service.findUserReaction('u1')).toBeNull();
      expect(reactionRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
    });

    it('narrows to a post', async () => {
      reactionRepo.findOne.mockResolvedValue(null);

      await service.findUserReaction('u1', 'post-1');

      expect(reactionRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'u1', post: { id: 'post-1' } },
      });
    });

    it('narrows to a comment', async () => {
      reactionRepo.findOne.mockResolvedValue(null);

      await service.findUserReaction('u1', undefined, 'comment-1');

      expect(reactionRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'u1', comment: { id: 'comment-1' } },
      });
    });
  });

  describe('update / remove', () => {
    it('updates the reaction', async () => {
      reactionRepo.update.mockResolvedValue({} as any);

      await service.update('r1', { value: 5 });

      expect(reactionRepo.update).toHaveBeenCalledWith('r1', { value: 5 });
    });

    it('deletes the reaction and reports success', async () => {
      reactionRepo.delete.mockResolvedValue({} as any);

      expect(await service.remove('r1')).toEqual({ success: true });
      expect(reactionRepo.delete).toHaveBeenCalledWith('r1');
    });
  });

  describe('getReactionCounts', () => {
    it('tallies reactions by value for a post', async () => {
      reactionRepo.find.mockResolvedValue([
        { value: 1 },
        { value: 1 },
        { value: 4 },
      ] as Reaction[]);

      expect(await service.getReactionCounts('post-1')).toEqual({
        1: 2,
        4: 1,
      });
    });

    it('returns an empty tally when there are no reactions', async () => {
      reactionRepo.find.mockResolvedValue([]);

      expect(await service.getReactionCounts('post-1')).toEqual({});
    });
  });

  describe('getCommentReactionCounts', () => {
    it('tallies reactions by value for a comment', async () => {
      reactionRepo.find.mockResolvedValue([
        { value: 2 },
        { value: 2 },
        { value: 2 },
      ] as Reaction[]);

      expect(await service.getCommentReactionCounts('comment-1')).toEqual({
        2: 3,
      });
    });

    it('returns an empty tally when there are no reactions', async () => {
      reactionRepo.find.mockResolvedValue([]);

      expect(await service.getCommentReactionCounts('comment-1')).toEqual({});
    });
  });
});
