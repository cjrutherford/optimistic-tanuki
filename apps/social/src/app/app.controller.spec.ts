import { Test, TestingModule } from '@nestjs/testing';
import { Like } from 'typeorm';
import { AppController } from './app.controller';
import { AttachmentService } from './services/attachment.service';
import { CommentService } from './services/comment.service';
import FollowService from './services/follow.service';
import { PostService } from './services/post.service';
import { RpcException } from '@nestjs/microservices';
import { VoteService } from './services/vote.service';
import { SocialComponentService } from './services/social-component.service';
import { ReactionService } from './services/reaction.service';
import { CommunityService } from './services/community.service';
import { NotificationService } from './services/notification.service';
import { SearchService } from './services/search.service';
import { PrivacyService } from './services/privacy.service';
import { ActivityService } from './services/activity.service';
import { PresenceService } from './services/presence.service';
import { ProfileAnalyticsService } from './services/profile-analytics.service';
import { PollService } from './services/poll.service';
import { PostShareService } from './services/post-share.service';
import { EventService } from './services/event.service';
import { LinkService } from './services/link.service';
import { ServiceTokens } from '@optimistic-tanuki/constants';

describe('AppController', () => {
  let controller: AppController;
  let postService: jest.Mocked<PostService>;
  let voteService: jest.Mocked<VoteService>;
  let attachmentService: jest.Mocked<AttachmentService>;
  let commentService: jest.Mocked<CommentService>;
  let followService: jest.Mocked<FollowService>;
  let socialComponentService: jest.Mocked<SocialComponentService>;

  beforeEach(async () => {
    postService = {
      create: jest.fn(),
      findAll: jest.fn().mockResolvedValue([
        { id: '1', title: 'Post 1' },
        { id: '2', title: 'Post 2' },
      ]),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      createScheduledPost: jest.fn(),
      updateScheduledPost: jest.fn(),
      deleteScheduledPost: jest.fn(),
      findScheduledPosts: jest.fn(),
      publishScheduledPost: jest.fn(),
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
    socialComponentService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      findByType: jest.fn(),
      findByPostId: jest.fn(),
      findByQuery: jest.fn(),
      removeByPostId: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: PostService, useValue: postService },
        { provide: VoteService, useValue: voteService },
        {
          provide: ReactionService,
          useValue: {
            create: jest.fn(),
            findUserReaction: jest.fn(),
            remove: jest.fn(),
            update: jest.fn(),
            findOne: jest.fn(),
            findByPostId: jest.fn(),
            findByCommentId: jest.fn(),
            getReactionCounts: jest.fn(),
          },
        },
        { provide: AttachmentService, useValue: attachmentService },
        { provide: CommentService, useValue: commentService },
        { provide: FollowService, useValue: followService },
        { provide: SocialComponentService, useValue: socialComponentService },
        {
          provide: CommunityService,
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            findBySlug: jest.fn(),
            listLocality: jest.fn(),
            getSubCommunities: jest.fn(),
            findAll: jest.fn(),
            getTopActive: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            join: jest.fn(),
            leave: jest.fn(),
            getMembers: jest.fn(),
            isMember: jest.fn(),
            getUserCommunities: jest.fn(),
            getCommunitiesByProfileId: jest.fn(),
            invite: jest.fn(),
            cancelInvite: jest.fn(),
            getPendingInvites: jest.fn(),
            getPendingJoinRequests: jest.fn(),
            approveMember: jest.fn(),
            rejectMember: jest.fn(),
            removeMember: jest.fn(),
            updateMemberRole: jest.fn(),
            getCommunityChatRoom: jest.fn(),
            setCommunityChatRoom: jest.fn(),
            getCommunityManager: jest.fn(),
            getActiveElection: jest.fn(),
            startElection: jest.fn(),
            nominateForElection: jest.fn(),
            voteInElection: jest.fn(),
            closeElection: jest.fn(),
            withdrawCandidate: jest.fn(),
            appointManager: jest.fn(),
            revokeManager: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            findByRecipient: jest.fn(),
            markAsRead: jest.fn(),
            markAllAsRead: jest.fn(),
            delete: jest.fn(),
            getUnreadCount: jest.fn(),
            queueNotification: jest.fn(),
          },
        },
        {
          provide: SearchService,
          useValue: {
            search: jest.fn(),
            getTrending: jest.fn(),
            getSuggestedUsers: jest.fn(),
            getSuggestedCommunities: jest.fn(),
            getSearchHistory: jest.fn(),
          },
        },
        {
          provide: PrivacyService,
          useValue: {
            blockUser: jest.fn(),
            unblockUser: jest.fn(),
            getBlockedUsers: jest.fn(),
            isUserBlocked: jest.fn(),
            muteUser: jest.fn(),
            unmuteUser: jest.fn(),
            getMutedUsers: jest.fn(),
            reportContent: jest.fn(),
            getMyReports: jest.fn(),
          },
        },
        {
          provide: ActivityService,
          useValue: {
            createActivity: jest.fn(),
            findOne: jest.fn(),
            findByProfile: jest.fn(),
            deleteActivity: jest.fn(),
            saveItem: jest.fn(),
            unsaveItem: jest.fn(),
            findSavedItems: jest.fn(),
            isItemSaved: jest.fn(),
          },
        },
        {
          provide: PresenceService,
          useValue: {
            setPresence: jest.fn(),
            getPresence: jest.fn(),
            getPresenceBatch: jest.fn(),
            getOnlineUsers: jest.fn(),
            updateLastSeen: jest.fn(),
            setOffline: jest.fn(),
          },
        },
        {
          provide: ProfileAnalyticsService,
          useValue: {
            recordView: jest.fn(),
            getViewStats: jest.fn(),
            getRecentViewers: jest.fn(),
          },
        },
        {
          provide: PollService,
          useValue: {
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            findOne: jest.fn(),
            findMany: jest.fn(),
            vote: jest.fn(),
            removeVote: jest.fn(),
          },
        },
        {
          provide: PostShareService,
          useValue: {
            create: jest.fn(),
            remove: jest.fn(),
            findByPost: jest.fn(),
            findByProfile: jest.fn(),
          },
        },
        {
          provide: EventService,
          useValue: {
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            findOne: jest.fn(),
            findMany: jest.fn(),
            findUpcoming: jest.fn(),
            attend: jest.fn(),
            unattend: jest.fn(),
            isAttending: jest.fn(),
          },
        },
        {
          provide: LinkService,
          useValue: {
            create: jest
              .fn()
              .mockRejectedValue(
                new RpcException('Link Object Not Implemented')
              ),
            update: jest
              .fn()
              .mockRejectedValue(new Error('Link Object Not Implemented')),
            findOne: jest
              .fn()
              .mockRejectedValue(new Error('Link Object Not Implemented')),
            findAll: jest
              .fn()
              .mockRejectedValue(new Error('Link Object Not Implemented')),
          },
        },
        {
          provide: ServiceTokens.PROFILE_SERVICE,
          useValue: { send: jest.fn() },
        },
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
    postService.update.mockResolvedValue(undefined);
    const result = await controller.updatePost('1', {} as any, 'user-1');
    expect(result).toBeUndefined();
    expect(postService.update).toHaveBeenCalledWith('1', {}, 'user-1');
  });

  it('should remove a post', async () => {
    postService.remove.mockResolvedValue(undefined);
    const result = await controller.removePost('1', 'user-1');
    expect(result).toBeUndefined();
    expect(postService.remove).toHaveBeenCalledWith('1', 'user-1');
  });

  it('should upvote a post', async () => {
    voteService.create.mockResolvedValue('upvoted');
    const result = await controller.upvotePost('1', 'u1');
    expect(result).toBe('upvoted');
    expect(voteService.create).toHaveBeenCalledWith({
      postId: '1',
      value: 1,
      userId: 'u1',
    });
  });

  it('should downvote a post', async () => {
    voteService.create.mockResolvedValue('downvoted');
    const result = await controller.downvotePost('1', 'u1');
    expect(result).toBe('downvoted');
    expect(voteService.create).toHaveBeenCalledWith({
      postId: '1',
      value: -1,
      userId: 'u1',
    });
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
    expect(voteService.findAll).toHaveBeenCalledWith({
      where: { post: { id: '1' } },
    });
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
    await expect(controller.createLink({} as any)).rejects.toThrow(
      RpcException
    );
    await expect(controller.updateLink('1', {} as any)).rejects.toThrow(
      'Link Object Not Implemented'
    );
    await expect(controller.findLink('1')).rejects.toThrow(
      'Link Object Not Implemented'
    );
    await expect(controller.findAllLinks({} as any)).rejects.toThrow(
      'Link Object Not Implemented'
    );
  });

  it('should return paginated posts', async () => {
    const result = await controller.findAllPosts(
      { title: 'Test' },
      { limit: 2, offset: 0 }
    );

    expect(postService.findAll).toHaveBeenCalledWith({
      where: { title: Like('%Test%') },
      take: 2,
      // skip: 0,
    });
    expect(result).toEqual([
      {
        id: '1',
        title: 'Post 1',
        attachments: [],
        comments: [],
        links: [],
        votes: [],
      },
      {
        id: '2',
        title: 'Post 2',
        attachments: [],
        comments: [],
        links: [],
        votes: [],
      },
    ]);
  });

  it('should enforce maximum limit of 100 posts per request', async () => {
    const result = await controller.findAllPosts(
      { title: 'Test' },
      { limit: 200, offset: 0 } // Request 200 but should be capped at 100
    );

    expect(postService.findAll).toHaveBeenCalledWith({
      where: { title: Like('%Test%') },
      take: 100, // Should be capped at MAX_LIMIT
    });
  });

  it('should apply default limit of 20 when no limit specified', async () => {
    const result = await controller.findAllPosts(
      { title: 'Test' },
      {} // No opts provided
    );

    expect(postService.findAll).toHaveBeenCalledWith({
      where: { title: Like('%Test%') },
      take: 20, // Should default to 20
    });
  });

  it('should apply default limit when opts is undefined', async () => {
    const result = await controller.findAllPosts({ title: 'Test' }, undefined);

    expect(postService.findAll).toHaveBeenCalledWith({
      where: { title: Like('%Test%') },
      take: 20, // Should default to 20
    });
  });

  it('should call follow methods', async () => {
    followService.follow.mockResolvedValue('followed');
    const result = await controller.follow({
      followerId: 'a',
      followeeId: 'b',
    });
    expect(result).toBe('followed');
    expect(followService.follow).toHaveBeenCalledWith('a', 'b');

    followService.unfollow.mockResolvedValue('unfollowed');
    const result2 = await controller.unfollow({
      followerId: 'a',
      followeeId: 'b',
    });
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
    const followerCount = await controller.getFollowerCount({
      followeeId: 'b',
    });
    expect(followerCount).toBe(5);
    expect(followService.getFollowerCount).toHaveBeenCalledWith('b');

    followService.getFollowingCount.mockResolvedValue(3);
    const followingCount = await controller.getFollowingCount({
      followerId: 'a',
    });
    expect(followingCount).toBe(3);
    expect(followService.getFollowingCount).toHaveBeenCalledWith('a');
  });
});
