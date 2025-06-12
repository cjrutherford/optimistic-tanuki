import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller';
import { PostService } from './services/post.service';
import { VoteService } from './services/vote.service';
import { AttachmentService } from './services/attachment.service';
import { CommentService } from './services/comment.service';
import FollowService from './services/follow.service';
import {
  CreateAttachmentDto,
  CreatePostDto,
  QueryFollowsDto,
  SearchPostOptions,
  UpdateFollowDto,
} from '@optimistic-tanuki/models';

describe('AppController', () => {
  let app: TestingModule;
  let controller: AppController;
  let postService: PostService;
  let voteService: VoteService;
  let attachmentService: AttachmentService;
  let commentService: CommentService;
  let followService: FollowService;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        FollowService,
        { provide: PostService, useValue: postService },
        { provide: VoteService, useValue: voteService },
        { provide: AttachmentService, useValue: attachmentService },
        { provide: CommentService, useValue: commentService },
      ],
    })
      .overrideProvider(PostService)
      .useValue({
        create: jest.fn(),
        findAll: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
      })
      .overrideProvider(VoteService)
      .useValue({
        create: jest.fn(),
        findAll: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
      })
      .overrideProvider(AttachmentService)
      .useValue({
        create: jest.fn(),
        findAll: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
      })
      .overrideProvider(CommentService)
      .useValue({
        create: jest.fn(),
        findAll: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
      })
      .overrideProvider(FollowService)
      .useValue({
        follow: jest.fn(),
        unfollow: jest.fn(),
        getFollowers: jest.fn(),
        getFollowing: jest.fn(),
        getMutuals: jest.fn(),
        getFollowerCount: jest.fn(),
        getFollowingCount: jest.fn(),
      })
      .compile();

    controller = app.get<AppController>(AppController);
    postService = app.get<PostService>(PostService);
    voteService = app.get<VoteService>(VoteService);
    attachmentService = app.get<AttachmentService>(AttachmentService);
    commentService = app.get<CommentService>(CommentService);
    followService = app.get<FollowService>(FollowService);
  });

  describe('constructor', () => {
    it('should be defined', () => {
      const appController = app.get<AppController>(AppController);
      expect(appController).toBeDefined();
    });

    it('should have postService defined', () => {
      expect(postService).toBeDefined();
    });

    it('should have voteService defined', () => {
      expect(voteService).toBeDefined();
    });

    it('should have attachmentService defined', () => {
      expect(attachmentService).toBeDefined();
    });

    it('should have commentService defined', () => {
      expect(commentService).toBeDefined();
    });
  });

  describe('createPost', () => {
    it('should create a post', async () => {
      const createPostDto: CreatePostDto = {
        title: 'Test Post',
        content: 'This is a test post.',
        userId: '',
        profileId: '',
      };
      (postService.create as jest.Mock).mockResolvedValue({
        id: '1',
        title: 'Test Post',
      });
      const result = await controller.createPost(createPostDto);
      expect(result).toEqual({ id: '1', title: 'Test Post' });
      expect(postService.create).toHaveBeenCalledWith(createPostDto);
    });
  });

  describe('findAllPosts', () => {
    it('should return an array of posts', async () => {
      const mockPosts = [{ id: '1', title: 'Test Post' }];
      (postService.findAll as jest.Mock).mockResolvedValue(mockPosts);
      const result = await controller.findAllPosts({}, {});
      expect(result).toEqual(mockPosts);
      expect(postService.findAll).toHaveBeenCalled();
    });

    it('should handle pagination and sorting', async () => {
      const mockPosts = [{ id: '1', title: 'Test Post' }];
      (postService.findAll as jest.Mock).mockResolvedValue(mockPosts);
      (voteService.findAll as jest.Mock).mockResolvedValue([]);
      (commentService.findAll as jest.Mock).mockResolvedValue([]);
      (attachmentService.findAll as jest.Mock).mockResolvedValue([]);
      const opts: SearchPostOptions = {
        limit: 10,
        offset: 0,
        orderBy: 'createdAt',
        orderDirection: 'asc',
      };
      const result = await controller.findAllPosts({}, opts);
      expect(result).toEqual(mockPosts);
      expect(postService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          order: { createdAt: 'asc' },
        })
      );
      expect(voteService.findAll).toHaveBeenCalled();
      expect(commentService.findAll).toHaveBeenCalled();
      expect(attachmentService.findAll).toHaveBeenCalled();
    });

    it('should populate votes, comments, and attachments for each post', async () => {
      const mockPosts = [{ id: '1', title: 'Test Post' }];
      (postService.findAll as jest.Mock).mockResolvedValue(mockPosts);
      (voteService.findAll as jest.Mock).mockResolvedValue([{ id: 'v1' }]);
      (commentService.findAll as jest.Mock).mockResolvedValue([{ id: 'c1' }]);
      (attachmentService.findAll as jest.Mock).mockResolvedValue([
        { id: 'a1' },
      ]);
      const result = await controller.findAllPosts({}, {});
      expect(result[0].votes).toEqual([{ id: 'v1' }]);
      expect(result[0].comments).toEqual([{ id: 'c1' }]);
      expect(result[0].attachments).toEqual([{ id: 'a1' }]);
    });
  });

  describe('findOnePost', () => {
    it('should return a post by id', async () => {
      const mockPost = { id: '1', title: 'Test Post' };
      (postService.findOne as jest.Mock).mockResolvedValue(mockPost);
      const result = await controller.findOnePost('1');
      expect(result).toEqual(mockPost);
      expect(postService.findOne).toHaveBeenCalledWith('1', {});
    });
  });

  describe('updatePost', () => {
    it('should update a post', async () => {
      const updateData = { title: 'Updated Post' };
      (postService.update as jest.Mock).mockResolvedValue({
        id: '1',
        ...updateData,
      });
      const result = await controller.updatePost(1, updateData);
      expect(result).toEqual({ id: '1', ...updateData });
      expect(postService.update).toHaveBeenCalledWith(1, updateData);
    });

    describe('removePost', () => {
      it('should remove a post', async () => {
        (postService.remove as jest.Mock).mockResolvedValue({ affected: 1 });
        const result = await controller.removePost(1);
        expect(result).toEqual({ affected: 1 });
        expect(postService.remove).toHaveBeenCalledWith(1);
      });
    });

    describe('upvotePost', () => {
      it('should upvote a post', async () => {
        const mockVote = { id: '1', postId: '1', value: 1, userId: 'user1' };
        (voteService.create as jest.Mock).mockResolvedValue(mockVote);
        const result = await controller.upvotePost('1', 'user1');
        expect(result).toEqual(mockVote);
        expect(voteService.create).toHaveBeenCalledWith({
          postId: '1',
          value: 1,
          userId: 'user1',
        });
      });
    });

    describe('downvotePost', () => {
      it('should downvote a post', async () => {
        const mockVote = { id: '1', postId: '1', value: -1, userId: 'user1' };
        (voteService.create as jest.Mock).mockResolvedValue(mockVote);
        const result = await controller.downvotePost('1', 'user1');
        expect(result).toEqual(mockVote);
        expect(voteService.create).toHaveBeenCalledWith({
          postId: '1',
          value: -1,
          userId: 'user1',
        });
      });
    });

    describe('unvotePost', () => {
      it('should unvote a post', async () => {
        (voteService.remove as jest.Mock).mockResolvedValue({ affected: 1 });
        const result = await controller.unvotePost(1);
        expect(result).toEqual({ affected: 1 });
        expect(voteService.remove).toHaveBeenCalledWith(1);
      });
    });

    describe('getVotes', () => {
      it('should return votes for a post', async () => {
        const mockVotes = [{ id: '1', postId: '1', value: 1, userId: 'user1' }];
        (voteService.findAll as jest.Mock).mockResolvedValue(mockVotes);
        const result = await controller.getVote('1');
        expect(result).toEqual(mockVotes);
        expect(voteService.findAll).toHaveBeenCalledWith({
          where: { post: { id: '1' } },
        });
      });
    });

    describe('createCommnent', () => {
      it('should create a comment', async () => {
        const mockComment = { id: '1', postId: '1', content: 'Test Comment' };
        (commentService.create as jest.Mock).mockResolvedValue(mockComment);
        const result = await controller.createComment({
          postId: '1',
          content: 'Test Comment',
          userId: 'user1',
          profileId: 'profile1',
        });
        expect(result).toEqual(mockComment);
        expect(commentService.create).toHaveBeenCalledWith({
          postId: '1',
          content: 'Test Comment',
          userId: 'user1',
          profileId: 'profile1',
        });
      });
    });

    describe('findAllComments', () => {
      it('should return an array of comments', async () => {
        const mockComments = [
          { id: '1', postId: '1', content: 'Test Comment' },
        ];
        (commentService.findAll as jest.Mock).mockResolvedValue(mockComments);
        const result = await controller.findAllComments({});
        expect(result).toEqual(mockComments);
        expect(commentService.findAll).toHaveBeenCalled();
      });
    });

    describe('findOneComment', () => {
      it('should return a comment by id', async () => {
        const mockComment = { id: '1', postId: '1', content: 'Test Comment' };
        (commentService.findOne as jest.Mock).mockResolvedValue(mockComment);
        // Ensure the mock is set before calling the controller method
        const result = await controller.findOneComment('1', {});
        expect(result).toEqual(mockComment);
        expect(commentService.findOne).toHaveBeenCalledWith('1', {
          where: {},
          relations: [],
        });
      });
    });

    describe('updateComment', () => {
      it('should update a comment', async () => {
        const updateData = { content: 'Updated Comment' };
        (commentService.update as jest.Mock).mockResolvedValue({
          id: '1',
          ...updateData,
        });
        const result = await controller.updateComment('1', updateData);
        expect(result).toEqual({ id: '1', ...updateData });
        expect(commentService.update).toHaveBeenCalledWith('1', updateData);
      });
    });

    describe('removeComment', () => {
      it('should remove a comment', async () => {
        (commentService.remove as jest.Mock).mockResolvedValue({ affected: 1 });
        const result = await controller.removeComment('1');
        expect(result).toEqual({ affected: 1 });
        expect(commentService.remove).toHaveBeenCalledWith('1');
      });
    });

    describe('createAttachment', () => {
      it('should create an attachment for a post', async () => {
        const mockAttachment = {
          id: '1',
          postId: '1',
          url: 'http://example.com/image.jpg',
        };
        const createBody: CreateAttachmentDto = {
          url: 'http://example.com/image.jpg',
          type: '',
          post: '',
        };
        (attachmentService.create as jest.Mock).mockResolvedValue(
          mockAttachment
        );
        const result = await controller.createAttachment(createBody, '1');
        expect(result).toEqual(mockAttachment);
        expect(attachmentService.create).toHaveBeenCalledWith(
          { post: '', type: '', url: 'http://example.com/image.jpg' },
          { id: '1', title: 'Test Post' }
        );
      });
    });

    describe('findAllAttachments', () => {
      it('should return an array of attachments', async () => {
        const mockAttachments = [
          { id: '1', postId: '1', url: 'http://example.com/image.jpg' },
        ];
        (attachmentService.findAll as jest.Mock).mockResolvedValue(
          mockAttachments
        );
        const result = await controller.findAllAttachments({});
        expect(result).toEqual(mockAttachments);
        expect(attachmentService.findAll).toHaveBeenCalled();
      });
    });

    describe('findOneAttachment', () => {
      it('should return an attachment by id', async () => {
        const mockAttachment = {
          id: '1',
          postId: '1',
          url: 'http://example.com/image.jpg',
        };
        (attachmentService.findOne as jest.Mock).mockResolvedValue(
          mockAttachment
        );
        const result = await controller.findAttachment('1', {});
        expect(result).toEqual(mockAttachment);
        expect(attachmentService.findOne).toHaveBeenCalledWith('1', {
          where: {},
        });
      });
    });

    describe('updateAttachment', () => {
      it('should update an attachment', async () => {
        const updateData = { url: 'http://example.com/updated.jpg' };
        (attachmentService.update as jest.Mock).mockResolvedValue({
          id: '1',
          ...updateData,
        });
        const result = await controller.updateAttachment('1', updateData);
        expect(result).toEqual({ id: '1', ...updateData });
        expect(attachmentService.update).toHaveBeenCalledWith('1', updateData);
      });
    });

    describe('deleteAttachment', () => {
      it('should delete an attachment', async () => {
        (attachmentService.remove as jest.Mock).mockResolvedValue({
          affected: 1,
        });
        const result = await controller.deleteAttachment('1');
        expect(result).toEqual({ affected: 1 });
        expect(attachmentService.remove).toHaveBeenCalledWith('1');
      });
    });

    describe('followUser', () => {
      it('should follow a user', async () => {
        const mockFollow = {
          id: '1',
          followerId: 'user1',
          followingId: 'user2',
        };
        (followService.follow as jest.Mock).mockResolvedValue(mockFollow);
        const mockFollowData: UpdateFollowDto = {
          followerId: 'user1',
          followeeId: 'user2',
        };
        const result = await controller.follow(mockFollowData);
        expect(result).toEqual(mockFollow);
        expect(followService.follow).toHaveBeenCalledWith('user1', 'user2');
      });
    });

    describe('unfollowUser', () => {
      it('should unfollow a user', async () => {
        (followService.unfollow as jest.Mock).mockResolvedValue({
          affected: 1,
        });
        const mockUnfollowData: UpdateFollowDto = {
          followerId: 'user1',
          followeeId: 'user2',
        };
        const result = await controller.unfollow(mockUnfollowData);
        expect(result).toEqual({ affected: 1 });
        expect(followService.unfollow).toHaveBeenCalledWith('user1', 'user2');
      });
    });

    describe('getFollowers', () => {
      it('should return followers of a user', async () => {
        const mockFollowers = [
          { id: '1', followerId: 'user1', followingId: 'user2' },
        ];
        (followService.getFollowers as jest.Mock).mockResolvedValue(
          mockFollowers
        );
        const query: QueryFollowsDto = { followeeId: 'user2' };
        const result = await controller.getFollowers(query);
        expect(result).toEqual(mockFollowers);
        expect(followService.getFollowers).toHaveBeenCalledWith('user2');
      });
    });

    describe('getFollowing', () => {
      it('should return users followed by a user', async () => {
        const mockFollowing = [
          { id: '1', followerId: 'user1', followingId: 'user2' },
        ];
        (followService.getFollowing as jest.Mock).mockResolvedValue(
          mockFollowing
        );
        const query: QueryFollowsDto = { followerId: 'user1' };
        const result = await controller.getFollowing(query);
        expect(result).toEqual(mockFollowing);
        expect(followService.getFollowing).toHaveBeenCalledWith('user1');
      });
    });

    describe('getMutuals', () => {
      it('should return mutual followers', async () => {
        const mockMutuals = [
          { id: '1', followerId: 'user1', followingId: 'user2' },
        ];
        (followService.getMutuals as jest.Mock).mockResolvedValue(mockMutuals);
        const query: QueryFollowsDto = { followerId: 'user1' };
        const result = await controller.getMutuals(query);
        expect(result).toEqual(mockMutuals);
        expect(followService.getMutuals).toHaveBeenCalledWith('user1');
      });
    });

    describe('getFollowerCount', () => {
      it('should return follower count for a user', async () => {
        (followService.getFollowerCount as jest.Mock).mockResolvedValue(10);
        const query: QueryFollowsDto = { followeeId: 'user2' };
        const result = await controller.getFollowerCount(query);
        expect(result).toEqual(10);
        expect(followService.getFollowerCount).toHaveBeenCalledWith('user2');
      });
    });

    describe('getFollowingCount', () => {
      it('should return following count for a user', async () => {
        (followService.getFollowingCount as jest.Mock).mockResolvedValue(5);
        const query: QueryFollowsDto = { followerId: 'user1' };
        const result = await controller.getFollowingCount(query);
        expect(result).toEqual(5);
        expect(followService.getFollowingCount).toHaveBeenCalledWith('user1');
      });
    });
  });
});
