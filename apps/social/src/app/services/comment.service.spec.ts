import { CreateCommentDto, UpdateCommentDto } from '@optimistic-tanuki/models';

import { Comment } from '../../entities/comment.entity';
import { CommentService } from './comment.service';
import { Post } from '../../entities/post.entity';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';

describe('CommentService', () => {
  let service: CommentService;
  let commentRepo: Partial<Repository<Comment>>;
  let postRepo: Partial<Repository<Post>>;

  beforeEach(() => {
    commentRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    postRepo = {
      findOne: jest.fn(),
    };
    service = new CommentService(commentRepo as Repository<Comment>, postRepo as Repository<Post>);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a comment if post exists', async () => {
      const dto: CreateCommentDto = { content: 'test', userId: 'u1', postId: 'p1', profileId: 'pr1' };
      const post = { id: 'p1' } as Post;
      const created: Comment = {
        id: 'c1',
        content: dto.content,
        userId: dto.userId,
        postId: dto.postId,
        profileId: dto.profileId,
        post,
        replies: [],
        parent: null,
        votes: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Comment;
      postRepo.findOne.mockResolvedValue(post);
      commentRepo.create.mockReturnValue(created);
      commentRepo.save.mockResolvedValue(created);
      const result = await service.create(dto);
      expect(postRepo.findOne).toHaveBeenCalledWith({ where: { id: dto.postId } });
      expect(commentRepo.create).toHaveBeenCalledWith({ ...dto, post });
      expect(commentRepo.save).toHaveBeenCalledWith(created);
      expect(result).toBe(created);
    });

    it('should throw RpcException if post does not exist', async () => {
      const dto: CreateCommentDto = { content: 'test', userId: 'u1', postId: 'p1', profileId: 'pr1' };
      postRepo.findOne.mockResolvedValue(undefined);
      await expect(service.create(dto)).rejects.toThrow(RpcException);
    });

    it('should throw RpcException on repo error', async () => {
      const dto: CreateCommentDto = { content: 'test', userId: 'u1', postId: 'p1', profileId: 'pr1' };
      postRepo.findOne.mockRejectedValue(new Error('fail'));
      await expect(service.create(dto)).rejects.toThrow(RpcException);
    });
  });

  describe('findAll', () => {
    it('should return all comments', async () => {
      const comments = [{ id: 'c1' }] as Comment[];
      commentRepo.find.mockResolvedValue(comments);
      const result = await service.findAll();
      expect(commentRepo.find).toHaveBeenCalled();
      expect(result).toBe(comments);
    });
  });

  describe('findOne', () => {
    it('should return one comment by id', async () => {
      const comment = { id: 'c1' } as Comment;
      commentRepo.findOne.mockResolvedValue(comment);
      const result = await service.findOne('c1');
      expect(commentRepo.findOne).toHaveBeenCalledWith({ where: { id: 'c1' } });
      expect(result).toBe(comment);
    });
  });

  describe('update', () => {
    it('should update a comment', async () => {
      commentRepo.update.mockResolvedValue(undefined);
      const dto: UpdateCommentDto = { content: 'updated' };
      await service.update('c1', dto);
      expect(commentRepo.update).toHaveBeenCalledWith('c1', dto);
    });
  });

  describe('remove', () => {
    it('should delete a comment', async () => {
      commentRepo.delete.mockResolvedValue(undefined);
      await service.remove('c1');
      expect(commentRepo.delete).toHaveBeenCalledWith('c1');
    });
  });
});
