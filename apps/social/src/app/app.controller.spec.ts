import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller';
import { AttachmentService } from './services/attachment.service';
import { CommentService } from './services/comment.service';
import FollowService from './services/follow.service';
import { PostService } from './services/post.service';
import { RpcException } from '@nestjs/microservices';
import { VoteService } from './services/vote.service';

describe('AppController', () => {
  let controller: AppController;
  let postService: jest.Mocked<PostService>;
  let voteService: jest.Mocked<VoteService>;
  let attachmentService: jest.Mocked<AttachmentService>;
  let commentService: jest.Mocked<CommentService>;
  let followService: jest.Mocked<FollowService>;

  beforeEach(async () => {
    postService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as any;
    voteService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as any;
    attachmentService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as any;
    commentService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as any;
    followService = {
      follow: jest.fn(),
      unfollow: jest.fn(),
      getFollowers: jest.fn(),
      getFollowing: jest.fn(),
      getMutuals: jest.fn(),
      getFollowerCount: jest.fn(),
      getFollowingCount: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: PostService, useValue: postService },
        { provide: VoteService, useValue: voteService },
        { provide: AttachmentService, useValue: attachmentService },
        { provide: CommentService, useValue: commentService },
        { provide: FollowService, useValue: followService },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a post', async () => {
    postService.create.mockResolvedValue('created');
    const result = await controller.createPost({} as any);
    expect(result).toBe('created');
    expect(postService.create).toHaveBeenCalled();
  });

  it('should find all posts', async () => {
    postService.findAll.mockResolvedValue([{ id: 1 }]);
    voteService.findAll.mockResolvedValue([]);
    commentService.findAll.mockResolvedValue([]);
    attachmentService.findAll.mockResolvedValue([]);
    const result = await controller.findAllPosts({} as any, {} as any);
    expect(Array.isArray(result)).toBe(true);
    expect(postService.findAll).toHaveBeenCalled();
  });

  it('should find one post', async () => {
    postService.findOne.mockResolvedValue({ id: 1 });
    const result = await controller.findOnePost('1');
    expect(result).toEqual({ id: 1 });
    expect(postService.findOne).toHaveBeenCalledWith('1', {});
  });

  it('should update a post', async () => {
    postService.update.mockResolvedValue('updated');
    const result = await controller.updatePost(1, {} as any);
    expect(result).toBe('updated');
    expect(postService.update).toHaveBeenCalledWith(1, {});
  });

  it('should remove a post', async () => {
    postService.remove.mockResolvedValue('removed');
    const result = await controller.removePost(1);
    expect(result).toBe('removed');
    expect(postService.remove).toHaveBeenCalledWith(1);
  });

  it('should upvote a post', async () => {
    voteService.create.mockResolvedValue('upvoted');
    const result = await controller.upvotePost('1', 'u1');
    expect(result).toBe('upvoted');
    expect(voteService.create).toHaveBeenCalledWith({ postId: '1', value: 1, userId: 'u1' });
  });

  it('should downvote a post', async () => {
    voteService.create.mockResolvedValue('downvoted');
    const result = await controller.downvotePost('1', 'u1');
    expect(result).toBe('downvoted');
    expect(voteService.create).toHaveBeenCalledWith({ postId: '1', value: -1, userId: 'u1' });
  });

  it('should unvote a post', async () => {
    voteService.remove.mockResolvedValue('unvoted');
    const result = await controller.unvotePost(1);
    expect(result).toBe('unvoted');
    expect(voteService.remove).toHaveBeenCalledWith(1);
  });

  it('should get votes for a post', async () => {
    voteService.findAll.mockResolvedValue(['vote']);
    const result = await controller.getVote('1');
    expect(result).toEqual(['vote']);
    expect(voteService.findAll).toHaveBeenCalledWith({ where: { post: { id: '1' } } });
  });

  it('should create a comment', async () => {
    commentService.create.mockResolvedValue('comment');
    const result = await controller.createComment({} as any);
    expect(result).toBe('comment');
    expect(commentService.create).toHaveBeenCalled();
  });

  it('should find all comments', async () => {
    commentService.findAll.mockResolvedValue(['comment']);
    const result = await controller.findAllComments({} as any);
    expect(result).toEqual(['comment']);
    expect(commentService.findAll).toHaveBeenCalled();
  });

  it('should find one comment', async () => {
    commentService.findOne.mockResolvedValue('comment');
    const result = await controller.findOneComment('1', {} as any);
    expect(result).toBe('comment');
    expect(commentService.findOne).toHaveBeenCalled();
  });

  it('should update a comment', async () => {
    commentService.update.mockResolvedValue('updated');
    const result = await controller.updateComment('1', {} as any);
    expect(result).toBe('updated');
    expect(commentService.update).toHaveBeenCalledWith('1', {});
  });

  it('should remove a comment', async () => {
    commentService.remove.mockResolvedValue('removed');
    const result = await controller.removeComment('1');
    expect(result).toBe('removed');
    expect(commentService.remove).toHaveBeenCalledWith('1');
  });

  it('should create an attachment', async () => {
    postService.findOne.mockResolvedValue('post');
    attachmentService.create.mockResolvedValue('attachment');
    const result = await controller.createAttachment({} as any, '1');
    expect(result).toBe('attachment');
    expect(postService.findOne).toHaveBeenCalledWith('1');
    expect(attachmentService.create).toHaveBeenCalledWith({} as any, 'post');
  });

  it('should find all attachments', async () => {
    attachmentService.findAll.mockResolvedValue(['attachment']);
    const result = await controller.findAllAttachments({} as any);
    expect(result).toEqual(['attachment']);
    expect(attachmentService.findAll).toHaveBeenCalled();
  });

  it('should find an attachment', async () => {
    attachmentService.findOne.mockResolvedValue('attachment');
    const result = await controller.findAttachment('1', {} as any);
    expect(result).toBe('attachment');
    expect(attachmentService.findOne).toHaveBeenCalled();
  });

  it('should update an attachment', async () => {
    attachmentService.update.mockResolvedValue('updated');
    const result = await controller.updateAttachment('1', {} as any);
    expect(result).toBe('updated');
    expect(attachmentService.update).toHaveBeenCalledWith('1', {});
  });

  it('should delete an attachment', async () => {
    attachmentService.remove.mockResolvedValue('deleted');
    const result = await controller.deleteAttachment('1');
    expect(result).toBe('deleted');
    expect(attachmentService.remove).toHaveBeenCalledWith('1');
  });

  it('should throw for unimplemented link methods', async () => {
    await expect(controller.createLink({} as any)).rejects.toThrow(RpcException);
    await expect(controller.updateLink('1', {} as any)).rejects.toThrow('Link Object Not Implemented');
    await expect(controller.findLink('1')).rejects.toThrow('Link Object Not Implemented');
    await expect(controller.findAllLinks({} as any)).rejects.toThrow('Link Object Not Implemented');
  });

  it('should call follow methods', async () => {
    followService.follow.mockResolvedValue('followed');
    const result = await controller.follow({ followerId: 'a', followeeId: 'b' });
    expect(result).toBe('followed');
    expect(followService.follow).toHaveBeenCalledWith('a', 'b');

    followService.unfollow.mockResolvedValue('unfollowed');
    const result2 = await controller.unfollow({ followerId: 'a', followeeId: 'b' });
    expect(result2).toBe('unfollowed');
    expect(followService.unfollow).toHaveBeenCalledWith('a', 'b');

    followService.getFollowers.mockResolvedValue(['follower']);
    const followers = await controller.getFollowers({ followeeId: 'b' });
    expect(followers).toEqual(['follower']);
    expect(followService.getFollowers).toHaveBeenCalledWith('b');

    followService.getFollowing.mockResolvedValue(['following']);
    const following = await controller.getFollowing({ followerId: 'a' });
    expect(following).toEqual(['following']);
    expect(followService.getFollowing).toHaveBeenCalledWith('a');

    followService.getMutuals.mockResolvedValue(['mutual']);
    const mutuals = await controller.getMutuals({ followerId: 'a' });
    expect(mutuals).toEqual(['mutual']);
    expect(followService.getMutuals).toHaveBeenCalledWith('a');

    followService.getFollowerCount.mockResolvedValue(5);
    const followerCount = await controller.getFollowerCount({ followeeId: 'b' });
    expect(followerCount).toBe(5);
    expect(followService.getFollowerCount).toHaveBeenCalledWith('b');

    followService.getFollowingCount.mockResolvedValue(3);
    const followingCount = await controller.getFollowingCount({ followerId: 'a' });
    expect(followingCount).toBe(3);
    expect(followService.getFollowingCount).toHaveBeenCalledWith('a');
  });
});
