import { CreateCommentDto, UpdateCommentDto } from '@optimistic-tanuki/models';

import { Comment } from '../../entities/comment.entity';
import { CommentService } from './comment.service';
import { Post } from '../../entities/post.entity';
import { FindOperator, Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { PostVisibilityScope } from '../common/post-visibility.util';

function evalOperator(value: unknown, op: FindOperator<any>): boolean {
  switch (op.type) {
    case 'in':
      return Array.isArray(op.value) && op.value.includes(value);
    case 'not':
      return Array.isArray(op.value)
        ? !op.value.includes(value)
        : value !== op.value;
    default:
      throw new Error(`unsupported FindOperator type: ${op.type}`);
  }
}

function matchesBranch(entity: any, branch: Record<string, any>): boolean {
  return Object.entries(branch).every(([key, cond]) => {
    const value = entity ? entity[key] : undefined;
    if (cond instanceof FindOperator) {
      return evalOperator(value, cond);
    }
    if (cond && typeof cond === 'object') {
      return matchesBranch(value, cond);
    }
    return value === cond;
  });
}

function matchesWhere(
  entity: any,
  where: Record<string, any> | Record<string, any>[] | undefined
): boolean {
  if (!where) return true;
  const branches = Array.isArray(where) ? where : [where];
  return branches.some((branch) => matchesBranch(entity, branch));
}

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
    service = new CommentService(
      commentRepo as Repository<Comment>,
      postRepo as Repository<Post>
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a comment if post exists', async () => {
      const dto: CreateCommentDto = {
        content: 'test',
        userId: 'u1',
        postId: 'p1',
        profileId: 'pr1',
      };
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
      expect(postRepo.findOne).toHaveBeenCalledWith({
        where: { id: dto.postId },
      });
      expect(commentRepo.create).toHaveBeenCalledWith({ ...dto, post });
      expect(commentRepo.save).toHaveBeenCalledWith(created);
      expect(result).toBe(created);
    });

    it('should throw RpcException if post does not exist', async () => {
      const dto: CreateCommentDto = {
        content: 'test',
        userId: 'u1',
        postId: 'p1',
        profileId: 'pr1',
      };
      postRepo.findOne.mockResolvedValue(undefined);
      await expect(service.create(dto)).rejects.toThrow(RpcException);
    });

    it('should throw RpcException on repo error', async () => {
      const dto: CreateCommentDto = {
        content: 'test',
        userId: 'u1',
        postId: 'p1',
        profileId: 'pr1',
      };
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
      expect(commentRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'c1', moderationStatus: 'visible' },
      });
      expect(result).toBe(comment);
    });

    it('should handle where as an array in findOne', async () => {
      const comment = { id: 'c1' } as Comment;
      commentRepo.findOne.mockResolvedValue(comment);
      await service.findOne('c1', {
        where: [{ userId: 'u1' }, { profileId: 'pr1' }],
      });
      expect(commentRepo.findOne).toHaveBeenCalledWith({
        where: [
          { userId: 'u1', id: 'c1', moderationStatus: 'visible' },
          { profileId: 'pr1', id: 'c1', moderationStatus: 'visible' },
        ],
      });
    });

    it('should handle where as an object in findOne', async () => {
      const comment = { id: 'c1' } as Comment;
      commentRepo.findOne.mockResolvedValue(comment);
      await service.findOne('c1', { where: { userId: 'u1' } });
      expect(commentRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'u1', id: 'c1', moderationStatus: 'visible' },
      });
    });
  });

  describe('post-visibility enforcement (findAllVisible / findOneVisible)', () => {
    const followersPost = {
      id: 'p-followers',
      visibility: 'followers',
      moderationStatus: 'visible',
      isScheduled: false,
      profileId: 'author-1',
    };
    const hiddenPost = {
      id: 'p-hidden',
      visibility: 'public',
      moderationStatus: 'hidden',
      isScheduled: false,
      profileId: 'author-2',
    };
    const scheduledPost = {
      id: 'p-scheduled',
      visibility: 'public',
      moderationStatus: 'visible',
      isScheduled: true,
      profileId: 'author-3',
    };
    const publicPost = {
      id: 'p-public',
      visibility: 'public',
      moderationStatus: 'visible',
      isScheduled: false,
      profileId: 'author-4',
    };

    const comments = [
      { id: 'c-followers', moderationStatus: 'visible', post: followersPost },
      { id: 'c-hidden-post', moderationStatus: 'visible', post: hiddenPost },
      {
        id: 'c-scheduled-post',
        moderationStatus: 'visible',
        post: scheduledPost,
      },
      { id: 'c-public', moderationStatus: 'visible', post: publicPost },
      { id: 'c-hidden-comment', moderationStatus: 'hidden', post: publicPost },
    ] as unknown as Comment[];

    beforeEach(() => {
      (commentRepo.find as jest.Mock).mockImplementation(async (options: any) =>
        comments.filter((c) => matchesWhere(c, options?.where))
      );
      (commentRepo.findOne as jest.Mock).mockImplementation(
        async (options: any) =>
          comments.find((c) => matchesWhere(c, options?.where))
      );
    });

    it('does not return a comment on a followers-only post to a non-follower', async () => {
      const scope: PostVisibilityScope = {
        viewerProfileId: 'viewer-1',
        followedProfileIds: [],
        blockedProfileIds: [],
      };
      const result = await service.findAllVisible(undefined, scope);
      expect(result.map((c) => c.id)).not.toContain('c-followers');
    });

    it('returns a comment on a followers-only post to a follower', async () => {
      const scope: PostVisibilityScope = {
        viewerProfileId: 'viewer-2',
        followedProfileIds: ['author-1'],
        blockedProfileIds: [],
      };
      const result = await service.findAllVisible(undefined, scope);
      expect(result.map((c) => c.id)).toContain('c-followers');
    });

    it('returns a comment on a followers-only post to the post author', async () => {
      const scope: PostVisibilityScope = {
        viewerProfileId: 'author-1',
        followedProfileIds: [],
        blockedProfileIds: [],
      };
      const result = await service.findAllVisible(undefined, scope);
      expect(result.map((c) => c.id)).toContain('c-followers');
    });

    it('excludes comments on a moderator-hidden post from a normal viewer', async () => {
      const scope: PostVisibilityScope = {
        viewerProfileId: 'viewer-1',
        followedProfileIds: [],
        blockedProfileIds: [],
      };
      const result = await service.findAllVisible(undefined, scope);
      expect(result.map((c) => c.id)).not.toContain('c-hidden-post');
    });

    it('excludes comments on an unpublished scheduled post from a normal viewer', async () => {
      const scope: PostVisibilityScope = {
        viewerProfileId: 'viewer-1',
        followedProfileIds: [],
        blockedProfileIds: [],
      };
      const result = await service.findAllVisible(undefined, scope);
      expect(result.map((c) => c.id)).not.toContain('c-scheduled-post');
    });

    it('gives an anonymous viewer only public-post comments', async () => {
      const scope: PostVisibilityScope = {
        followedProfileIds: [],
        blockedProfileIds: [],
      };
      const result = await service.findAllVisible(undefined, scope);
      expect(result.map((c) => c.id)).toEqual(['c-public']);
    });

    it('still applies the comment moderation filter on top of post visibility', async () => {
      const scope: PostVisibilityScope = {
        viewerProfileId: 'viewer-1',
        followedProfileIds: [],
        blockedProfileIds: [],
      };
      const result = await service.findAllVisible(undefined, scope);
      expect(result.map((c) => c.id)).not.toContain('c-hidden-comment');
    });

    describe('findOneVisible', () => {
      it('returns undefined when the parent post is not visible to the viewer', async () => {
        const scope: PostVisibilityScope = {
          viewerProfileId: 'viewer-1',
          followedProfileIds: [],
          blockedProfileIds: [],
        };
        const result = await service.findOneVisible(
          'c-followers',
          undefined,
          scope
        );
        expect(result).toBeUndefined();
      });

      it('returns the comment when the parent post is visible to the viewer', async () => {
        const scope: PostVisibilityScope = {
          viewerProfileId: 'viewer-2',
          followedProfileIds: ['author-1'],
          blockedProfileIds: [],
        };
        const result = await service.findOneVisible(
          'c-followers',
          undefined,
          scope
        );
        expect(result?.id).toBe('c-followers');
      });
    });
  });

  describe('update', () => {
    it('should update a comment', async () => {
      commentRepo.update.mockResolvedValue(undefined);
      const dto: UpdateCommentDto = { content: 'updated' };
      await service.update('c1', dto);
      expect(commentRepo.update).toHaveBeenCalledWith('c1', dto);
    });

    it('should sanitize content in update', async () => {
      commentRepo.update.mockResolvedValue(undefined);
      const dto: UpdateCommentDto = {
        content: '<strong>Hello</strong><script>alert(1)</script>',
      };
      await service.update('c1', dto);
      expect(commentRepo.update).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({
          content: '<strong>Hello</strong>',
        })
      );
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
