import { of } from 'rxjs';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { AppController } from './app.controller';
import { PostService } from './services/post.service';
import { VoteService } from './services/vote.service';
import { ReactionService } from './services/reaction.service';
import { AttachmentService } from './services/attachment.service';
import { CommentService } from './services/comment.service';
import FollowService from './services/follow.service';
import { SocialComponentService } from './services/social-component.service';
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

interface QueryBuilderMock {
  where: jest.Mock;
  orderBy: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  getMany: jest.Mock;
}

function makeQueryBuilder(posts: unknown[]): QueryBuilderMock {
  const qb: QueryBuilderMock = {
    where: jest.fn(),
    orderBy: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    getMany: jest.fn().mockResolvedValue(posts),
  };
  qb.where.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  qb.skip.mockReturnValue(qb);
  qb.take.mockReturnValue(qb);
  return qb;
}

function createHarness() {
  const queryBuilder = makeQueryBuilder([]);
  const postRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
  };

  const postService = {
    postRepo,
    create: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    createScheduledPost: jest.fn(),
    updateScheduledPost: jest.fn(),
    deleteScheduledPost: jest.fn(),
    findScheduledPosts: jest.fn(),
    publishScheduledPost: jest.fn(),
  };
  const voteService = {
    castVote: jest.fn(),
    removeVoteByPostAndProfile: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
  };
  const reactionService = {
    create: jest.fn(),
    findUserReaction: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    findByPostId: jest.fn(),
    findByCommentId: jest.fn(),
    getReactionCounts: jest.fn(),
  };
  const attachmentService = {
    create: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const commentService = {
    create: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    findAllVisible: jest.fn(),
    findOneVisible: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const followService = {
    follow: jest.fn(),
    unfollow: jest.fn(),
    getFollowers: jest.fn(),
    getFollowing: jest.fn().mockResolvedValue([]),
    getMutuals: jest.fn(),
    getFollowerCount: jest.fn(),
    getFollowingCount: jest.fn(),
  };
  const socialComponentService = {
    create: jest.fn(),
    findByPostId: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    removeByPostId: jest.fn(),
    findByQuery: jest.fn(),
  };
  const communityService = {
    create: jest.fn(),
    findOne: jest.fn(),
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
    getUserCommunities: jest.fn().mockResolvedValue([]),
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
  };
  const notificationService = {
    create: jest.fn(),
    findOne: jest.fn(),
    findByRecipient: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    delete: jest.fn(),
    getUnreadCount: jest.fn(),
    queueNotification: jest.fn().mockResolvedValue(undefined),
  };
  const searchService = {
    search: jest.fn(),
    getTrending: jest.fn(),
    getSuggestedUsers: jest.fn(),
    getSuggestedCommunities: jest.fn(),
    getSearchHistory: jest.fn(),
  };
  const privacyService = {
    blockUser: jest.fn(),
    unblockUser: jest.fn(),
    getBlockedUsers: jest.fn().mockResolvedValue([]),
    getBlockersOf: jest.fn().mockResolvedValue([]),
    isUserBlocked: jest.fn(),
    muteUser: jest.fn(),
    unmuteUser: jest.fn(),
    getMutedUsers: jest.fn(),
    reportContent: jest.fn(),
    getMyReports: jest.fn(),
    getAllReports: jest.fn(),
    updateReportStatus: jest.fn(),
    moderateContent: jest.fn(),
  };
  const activityService = {
    createActivity: jest.fn(),
    findOne: jest.fn(),
    findByProfile: jest.fn(),
    deleteActivity: jest.fn(),
    saveItem: jest.fn(),
    unsaveItem: jest.fn(),
    findSavedItems: jest.fn(),
    isItemSaved: jest.fn(),
  };
  const presenceService = {
    setPresence: jest.fn(),
    getPresence: jest.fn(),
    getPresenceBatch: jest.fn(),
    getOnlineUsers: jest.fn(),
    updateLastSeen: jest.fn(),
    setOffline: jest.fn(),
  };
  const profileAnalyticsService = {
    recordView: jest.fn(),
    getViewStats: jest.fn(),
    getRecentViewers: jest.fn(),
  };
  const pollService = {
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findOne: jest.fn(),
    findMany: jest.fn(),
    vote: jest.fn(),
    removeVote: jest.fn(),
  };
  const postShareService = {
    create: jest.fn(),
    remove: jest.fn(),
    findByPost: jest.fn(),
    findByProfile: jest.fn(),
  };
  const eventService = {
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findOne: jest.fn(),
    findMany: jest.fn(),
    findUpcoming: jest.fn(),
    attend: jest.fn(),
    unattend: jest.fn(),
    isAttending: jest.fn(),
  };
  const linkService = {
    create: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
  };
  const profileClient = { send: jest.fn().mockReturnValue(of([])) };

  const logger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  const controller = new AppController(
    postService as unknown as PostService,
    voteService as unknown as VoteService,
    reactionService as unknown as ReactionService,
    attachmentService as unknown as AttachmentService,
    commentService as unknown as CommentService,
    followService as unknown as FollowService,
    socialComponentService as unknown as SocialComponentService,
    communityService as unknown as CommunityService,
    notificationService as unknown as NotificationService,
    searchService as unknown as SearchService,
    privacyService as unknown as PrivacyService,
    activityService as unknown as ActivityService,
    presenceService as unknown as PresenceService,
    profileAnalyticsService as unknown as ProfileAnalyticsService,
    pollService as unknown as PollService,
    postShareService as unknown as PostShareService,
    eventService as unknown as EventService,
    linkService as unknown as LinkService,
    profileClient as unknown as ClientProxy
  );
  (controller as unknown as { logger: typeof logger }).logger = logger;

  return {
    controller,
    logger,
    queryBuilder,
    postRepo,
    postService,
    voteService,
    reactionService,
    attachmentService,
    commentService,
    followService,
    socialComponentService,
    communityService,
    notificationService,
    searchService,
    privacyService,
    activityService,
    presenceService,
    profileAnalyticsService,
    pollService,
    postShareService,
    eventService,
    linkService,
    profileClient,
  };
}

type Harness = ReturnType<typeof createHarness>;

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('AppController delegation', () => {
  let h: Harness;

  beforeEach(() => {
    h = createHarness();
  });

  describe('post lifecycle', () => {
    it('creates a post, logs the activity and notifies mentioned profiles', async () => {
      h.postService.create.mockResolvedValue({ id: 'post-1' });
      h.profileClient.send.mockReturnValue(of([{ id: 'mentioned-1' }]));

      const result = await h.controller.createPost({
        content: 'hello @alice and @alice again',
        title: 'greeting @bob',
        profileId: 'author-1',
      } as never);

      expect(result).toEqual({ id: 'post-1' });
      expect(h.activityService.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'author-1',
          resourceId: 'post-1',
          resourceType: 'post',
        })
      );

      await flush();
      // @alice is de-duplicated, so only two lookups happen for three mentions
      expect(h.profileClient.send).toHaveBeenCalledTimes(2);
      expect(h.profileClient.send).toHaveBeenCalledWith(expect.anything(), {
        profileName: 'alice',
      });
      expect(h.notificationService.queueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'mentioned-1',
          type: 'mention',
          senderId: 'author-1',
          resourceId: 'post-1',
        })
      );
    });

    it('does not notify the author when they mention themselves', async () => {
      h.postService.create.mockResolvedValue({ id: 'post-2' });
      h.profileClient.send.mockReturnValue(of({ id: 'author-1' }));

      await h.controller.createPost({
        content: '@me looking at my own post',
        title: '',
        profileId: 'author-1',
      } as never);
      await flush();

      expect(h.notificationService.queueNotification).not.toHaveBeenCalled();
    });

    it('swallows profile lookup failures while processing mentions', async () => {
      h.postService.create.mockResolvedValue({ id: 'post-3' });
      h.profileClient.send.mockImplementation(() => {
        throw new Error('profile service down');
      });

      await h.controller.createPost({
        content: 'ping @carol',
        title: '',
        profileId: 'author-1',
      } as never);
      await flush();

      expect(h.logger.warn).toHaveBeenCalledWith(
        'Failed to process mention carol:',
        expect.any(Error)
      );
    });

    it('skips mention processing entirely when there are no mentions', async () => {
      h.postService.create.mockResolvedValue({ id: 'post-4' });

      await h.controller.createPost({
        content: 'plain text',
        title: 'no mentions',
        profileId: 'author-1',
      } as never);
      await flush();

      expect(h.profileClient.send).not.toHaveBeenCalled();
    });

    it('warns but still returns the post when activity logging fails', async () => {
      h.postService.create.mockResolvedValue({ id: 'post-5' });
      h.activityService.createActivity.mockRejectedValue(new Error('nope'));

      const result = await h.controller.createPost({
        content: '',
        title: '',
        profileId: 'author-1',
      } as never);

      expect(result).toEqual({ id: 'post-5' });
      expect(h.logger.warn).toHaveBeenCalledWith(
        'Failed to create activity log for post:',
        expect.any(Error)
      );
    });

    it('applies pagination options and the viewer visibility scope on findAllPosts', async () => {
      h.followService.getFollowing.mockResolvedValue([
        { followeeId: 'followed-1' },
      ]);
      h.privacyService.getBlockedUsers.mockResolvedValue([
        { blockedId: 'blocked-1' },
      ]);
      h.privacyService.getBlockersOf.mockResolvedValue([
        { blockerId: 'blocker-1' },
      ]);
      h.postService.findAll.mockResolvedValue([{ id: 'p1' }]);
      h.voteService.findAll.mockResolvedValue([{ id: 'v1' }]);
      h.commentService.findAll.mockResolvedValue([{ id: 'c1' }]);
      h.attachmentService.findAll.mockResolvedValue([{ id: 'a1' }]);

      const posts = await h.controller.findAllPosts(
        {} as never,
        {
          limit: 500,
          offset: 10,
          orderBy: 'createdAt',
          orderDirection: 'DESC',
        } as never,
        'viewer-1'
      );

      const options = h.postService.findAll.mock.calls[0][0];
      expect(options.take).toBe(100);
      expect(options.skip).toBe(10);
      expect(options.order).toEqual({ createdAt: 'DESC' });
      expect(options.where).toBeDefined();
      expect(h.followService.getFollowing).toHaveBeenCalledWith('viewer-1');
      expect(posts[0].votes).toEqual([{ id: 'v1' }]);
      expect(posts[0].comments).toEqual([{ id: 'c1' }]);
      expect(posts[0].attachments).toEqual([{ id: 'a1' }]);
    });

    it('scopes findOnePost by viewer visibility', async () => {
      h.postService.findOne.mockResolvedValue({ id: 'p1' });

      await h.controller.findOnePost('p1', undefined, 'viewer-1');

      const search = h.postService.findOne.mock.calls[0][1];
      expect(search.where).toBeDefined();
      expect(h.privacyService.getBlockersOf).toHaveBeenCalledWith('viewer-1');
    });

    it('rethrows removePost failures', async () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const logSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => undefined);
      h.postService.remove.mockRejectedValue(new Error('boom'));

      await expect(h.controller.removePost('p1', 'u1')).rejects.toThrow('boom');
      expect(errorSpy).toHaveBeenCalledWith('Error in removePost: boom');

      errorSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  describe('votes', () => {
    it('logs activity and notifies the author on a changed upvote', async () => {
      h.voteService.castVote.mockResolvedValue({
        vote: { id: 'vote-1' },
        changed: true,
      });
      h.postService.findOne.mockResolvedValue({
        id: 'p1',
        profileId: 'author-1',
      });

      const result = await h.controller.upvotePost({
        postId: 'p1',
        userId: 'u1',
        profileId: 'voter-1',
      } as never);

      expect(result).toEqual({ id: 'vote-1' });
      expect(h.voteService.castVote).toHaveBeenCalledWith(
        'p1',
        'voter-1',
        'u1',
        1
      );
      expect(h.notificationService.queueNotification).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId: 'author-1', type: 'like' })
      );
    });

    it('does not notify when the voter owns the post', async () => {
      h.voteService.castVote.mockResolvedValue({
        vote: { id: 'vote-2' },
        changed: true,
      });
      h.postService.findOne.mockResolvedValue({
        id: 'p1',
        profileId: 'voter-1',
      });

      await h.controller.upvotePost({
        postId: 'p1',
        userId: 'u1',
        profileId: 'voter-1',
      } as never);

      expect(h.notificationService.queueNotification).not.toHaveBeenCalled();
    });

    it('warns when the upvote activity log and notification both fail', async () => {
      h.voteService.castVote.mockResolvedValue({
        vote: { id: 'vote-3' },
        changed: true,
      });
      h.activityService.createActivity.mockRejectedValue(new Error('a'));
      h.postService.findOne.mockRejectedValue(new Error('b'));

      await h.controller.upvotePost({
        postId: 'p1',
        userId: 'u1',
        profileId: 'voter-1',
      } as never);

      expect(h.logger.warn).toHaveBeenCalledWith(
        'Failed to create activity log for upvote:',
        expect.any(Error)
      );
      expect(h.logger.warn).toHaveBeenCalledWith(
        'Failed to send notification for upvote:',
        expect.any(Error)
      );
    });

    it('skips side effects when the upvote did not change anything', async () => {
      h.voteService.castVote.mockResolvedValue({
        vote: { id: 'vote-4' },
        changed: false,
      });

      await h.controller.upvotePost({
        postId: 'p1',
        userId: 'u1',
        profileId: 'voter-1',
      } as never);

      expect(h.activityService.createActivity).not.toHaveBeenCalled();
      expect(h.postService.findOne).not.toHaveBeenCalled();
    });

    it('logs activity for a changed downvote', async () => {
      h.voteService.castVote.mockResolvedValue({
        vote: { id: 'vote-5' },
        changed: true,
      });

      const result = await h.controller.downvotePost({
        postId: 'p1',
        userId: 'u1',
        profileId: 'voter-1',
      } as never);

      expect(result).toEqual({ id: 'vote-5' });
      expect(h.voteService.castVote).toHaveBeenCalledWith(
        'p1',
        'voter-1',
        'u1',
        -1
      );
      expect(h.activityService.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'You downvoted a post' })
      );
    });

    it('warns when the downvote activity log fails', async () => {
      h.voteService.castVote.mockResolvedValue({
        vote: { id: 'vote-6' },
        changed: true,
      });
      h.activityService.createActivity.mockRejectedValue(new Error('a'));

      await h.controller.downvotePost({
        postId: 'p1',
        userId: 'u1',
        profileId: 'voter-1',
      } as never);

      expect(h.logger.warn).toHaveBeenCalledWith(
        'Failed to create activity log for downvote:',
        expect.any(Error)
      );
    });
  });

  describe('reactions', () => {
    it('rejects reactions on community posts from non-members', async () => {
      h.postService.findOne.mockResolvedValue({
        id: 'p1',
        communityId: 'c1',
      });
      h.communityService.isMember.mockResolvedValue(false);

      await expect(
        h.controller.addReaction({
          postId: 'p1',
          userId: 'u1',
          value: 'like',
        } as never)
      ).rejects.toBeInstanceOf(RpcException);
      expect(h.reactionService.create).not.toHaveBeenCalled();
    });

    it('toggles an identical reaction off', async () => {
      h.postService.findOne.mockResolvedValue({ id: 'p1' });
      h.reactionService.findUserReaction.mockResolvedValue({
        id: 'r1',
        value: 'like',
      });

      const result = await h.controller.addReaction({
        postId: 'p1',
        userId: 'u1',
        value: 'like',
      } as never);

      expect(result).toBeNull();
      expect(h.reactionService.remove).toHaveBeenCalledWith('r1');
    });

    it('updates a reaction whose value changed', async () => {
      h.postService.findOne.mockResolvedValue({ id: 'p1' });
      h.reactionService.findUserReaction.mockResolvedValue({
        id: 'r1',
        value: 'like',
      });
      h.reactionService.findOne.mockResolvedValue({ id: 'r1', value: 'love' });

      const result = await h.controller.addReaction({
        postId: 'p1',
        userId: 'u1',
        value: 'love',
      } as never);

      expect(h.reactionService.update).toHaveBeenCalledWith('r1', {
        value: 'love',
      });
      expect(result).toEqual({ id: 'r1', value: 'love' });
    });

    it('creates a new reaction on a comment when none exists', async () => {
      h.reactionService.findUserReaction.mockResolvedValue(null);
      h.reactionService.create.mockResolvedValue({ id: 'r2' });

      const dto = { commentId: 'cm1', userId: 'u1', value: 'like' };
      const result = await h.controller.addReaction(dto as never);

      expect(h.postService.findOne).not.toHaveBeenCalled();
      expect(h.reactionService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 'r2' });
    });

    it('reads reactions by post, comment, user and counts', async () => {
      h.reactionService.findByPostId.mockResolvedValue(['a']);
      h.reactionService.findByCommentId.mockResolvedValue(['b']);
      h.reactionService.findUserReaction.mockResolvedValue({ id: 'r' });
      h.reactionService.getReactionCounts.mockResolvedValue({ like: 2 });

      await expect(h.controller.getReactionsByPost('p1')).resolves.toEqual([
        'a',
      ]);
      await expect(h.controller.getReactionsByComment('cm1')).resolves.toEqual([
        'b',
      ]);
      await expect(
        h.controller.getUserReaction('u1', 'p1', 'cm1')
      ).resolves.toEqual({ id: 'r' });
      expect(h.reactionService.findUserReaction).toHaveBeenCalledWith(
        'u1',
        'p1',
        'cm1'
      );
      await expect(h.controller.getReactionCounts('p1')).resolves.toEqual({
        like: 2,
      });
    });
  });

  describe('comments', () => {
    it('notifies the post author and processes mentions', async () => {
      h.commentService.create.mockResolvedValue({ id: 'cm1' });
      h.postService.findOne.mockResolvedValue({
        id: 'p1',
        profileId: 'author-1',
      });
      h.profileClient.send.mockReturnValue(of([{ id: 'mentioned-1' }]));

      const result = await h.controller.createComment({
        postId: 'p1',
        profileId: 'commenter-1',
        content: 'nice work @dave',
      } as never);
      await flush();

      expect(result).toEqual({ id: 'cm1' });
      expect(h.notificationService.queueNotification).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId: 'author-1', type: 'comment' })
      );
      expect(h.notificationService.queueNotification).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId: 'mentioned-1', type: 'mention' })
      );
    });

    it('warns when the comment activity log fails and skips self-notification', async () => {
      h.commentService.create.mockResolvedValue({ id: 'cm2' });
      h.postService.findOne.mockResolvedValue({
        id: 'p1',
        profileId: 'commenter-1',
      });
      h.activityService.createActivity.mockRejectedValue(new Error('a'));

      await h.controller.createComment({
        postId: 'p1',
        profileId: 'commenter-1',
        content: 'my own post',
      } as never);
      await flush();

      expect(h.logger.warn).toHaveBeenCalledWith(
        'Failed to create activity log for comment:',
        expect.any(Error)
      );
      expect(h.notificationService.queueNotification).not.toHaveBeenCalled();
    });

    it('warns when queuing the comment notification rejects', async () => {
      h.commentService.create.mockResolvedValue({ id: 'cm3' });
      h.postService.findOne.mockResolvedValue({
        id: 'p1',
        profileId: 'author-1',
      });
      h.notificationService.queueNotification.mockRejectedValue(
        new Error('queue down')
      );

      await h.controller.createComment({
        postId: 'p1',
        profileId: 'commenter-1',
        content: 'hello',
      } as never);
      await flush();

      expect(h.logger.warn).toHaveBeenCalledWith(
        'Failed to queue notification:',
        expect.any(Error)
      );
    });
  });

  describe('follows', () => {
    it('logs activity and notifies the followee', async () => {
      h.followService.follow.mockResolvedValue({ id: 'f1' });

      const result = await h.controller.follow({
        followerId: 'a',
        followeeId: 'b',
      } as never);

      expect(result).toEqual({ id: 'f1' });
      expect(h.notificationService.queueNotification).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId: 'b', type: 'follow' })
      );
    });

    it('warns when the follow activity log and notification fail', async () => {
      h.followService.follow.mockResolvedValue({ id: 'f2' });
      h.activityService.createActivity.mockRejectedValue(new Error('a'));
      h.notificationService.queueNotification.mockRejectedValue(new Error('n'));

      await h.controller.follow({
        followerId: 'a',
        followeeId: 'b',
      } as never);

      expect(h.logger.warn).toHaveBeenCalledWith(
        'Failed to create activity log for follow:',
        expect.any(Error)
      );
      expect(h.logger.warn).toHaveBeenCalledWith(
        'Failed to send notification for follow:',
        expect.any(Error)
      );
    });

    it('logs activity on unfollow and warns when it fails', async () => {
      h.followService.unfollow.mockResolvedValue({ id: 'f3' });

      await expect(
        h.controller.unfollow({ followerId: 'a', followeeId: 'b' } as never)
      ).resolves.toEqual({ id: 'f3' });
      expect(h.activityService.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'You unfollowed a user' })
      );

      h.activityService.createActivity.mockRejectedValue(new Error('a'));
      await h.controller.unfollow({
        followerId: 'a',
        followeeId: 'b',
      } as never);
      expect(h.logger.warn).toHaveBeenCalledWith(
        'Failed to create activity log for unfollow:',
        expect.any(Error)
      );
    });
  });

  describe('social components', () => {
    it('creates, reads, updates and deletes components', async () => {
      h.socialComponentService.create.mockResolvedValue({ id: 'sc1' });
      h.socialComponentService.findByPostId.mockResolvedValue([{ id: 'sc1' }]);
      h.socialComponentService.findOne.mockResolvedValue({ id: 'sc1' });
      h.socialComponentService.update.mockResolvedValue({ id: 'sc1' });
      h.socialComponentService.remove.mockResolvedValue({ affected: 1 });
      h.socialComponentService.removeByPostId.mockResolvedValue({
        affected: 2,
      });
      h.socialComponentService.findByQuery.mockResolvedValue([{ id: 'sc1' }]);

      await expect(
        h.controller.createSocialComponent({
          postId: 'p1',
          instanceId: 'i1',
        } as never)
      ).resolves.toEqual({ id: 'sc1' });
      await expect(h.controller.getComponentsForPost('p1')).resolves.toEqual([
        { id: 'sc1' },
      ]);
      await expect(h.controller.findOneSocialComponent('sc1')).resolves.toEqual(
        { id: 'sc1' }
      );
      await expect(
        h.controller.updateSocialComponent({
          id: 'sc1',
          dto: {} as never,
        })
      ).resolves.toEqual({ id: 'sc1' });
      await expect(h.controller.deleteSocialComponent('sc1')).resolves.toEqual({
        affected: 1,
      });
      await expect(h.controller.deleteComponentsByPost('p1')).resolves.toEqual({
        affected: 2,
      });
      await expect(
        h.controller.findComponentsByQuery({ postId: 'p1' } as never)
      ).resolves.toEqual([{ id: 'sc1' }]);
    });

    it('logs and rethrows every social component failure', async () => {
      const failure = new Error('component failure');
      h.socialComponentService.create.mockRejectedValue(failure);
      h.socialComponentService.findByPostId.mockRejectedValue(failure);
      h.socialComponentService.findOne.mockRejectedValue(failure);
      h.socialComponentService.update.mockRejectedValue(failure);
      h.socialComponentService.remove.mockRejectedValue(failure);
      h.socialComponentService.removeByPostId.mockRejectedValue(failure);
      h.socialComponentService.findByQuery.mockRejectedValue(failure);

      await expect(
        h.controller.createSocialComponent({} as never)
      ).rejects.toThrow(failure);
      await expect(h.controller.getComponentsForPost('p1')).rejects.toThrow(
        failure
      );
      await expect(h.controller.findOneSocialComponent('sc1')).rejects.toThrow(
        failure
      );
      await expect(
        h.controller.updateSocialComponent({ id: 'sc1', dto: {} as never })
      ).rejects.toThrow(failure);
      await expect(h.controller.deleteSocialComponent('sc1')).rejects.toThrow(
        failure
      );
      await expect(h.controller.deleteComponentsByPost('p1')).rejects.toThrow(
        failure
      );
      await expect(
        h.controller.findComponentsByQuery(undefined as never)
      ).rejects.toThrow(failure);

      expect(h.logger.error).toHaveBeenCalledTimes(7);
    });
  });

  describe('communities', () => {
    it('delegates community reads and writes with the payload it receives', async () => {
      h.communityService.create.mockResolvedValue({ id: 'c1' });
      h.communityService.findOne.mockResolvedValue({ id: 'c1' });
      h.communityService.findBySlug.mockResolvedValue({ id: 'c1' });
      h.communityService.listLocality.mockResolvedValue([{ id: 'c1' }]);
      h.communityService.getSubCommunities.mockResolvedValue([{ id: 'c2' }]);
      h.communityService.findAll.mockResolvedValue([{ id: 'c1' }]);
      h.communityService.getTopActive.mockResolvedValue([{ id: 'c1' }]);
      h.communityService.update.mockResolvedValue({ id: 'c1' });
      h.communityService.join.mockResolvedValue({ id: 'm1' });
      h.communityService.getMembers.mockResolvedValue([{ id: 'm1' }]);
      h.communityService.isMember.mockResolvedValue(true);
      h.communityService.getCommunitiesByProfileId.mockResolvedValue([
        { id: 'c1' },
      ]);

      await expect(
        h.controller.createCommunity({
          dto: {} as never,
          userId: 'u1',
          profileId: 'pr1',
          appScope: 'app',
        })
      ).resolves.toEqual({ id: 'c1' });
      expect(h.communityService.create).toHaveBeenCalledWith(
        {},
        'u1',
        'pr1',
        'app'
      );

      await expect(h.controller.findCommunity('c1')).resolves.toEqual({
        id: 'c1',
      });
      await expect(
        h.controller.findCommunityBySlug({ slug: 'my-community' })
      ).resolves.toEqual({ id: 'c1' });
      expect(h.communityService.findBySlug).toHaveBeenCalledWith(
        'my-community'
      );

      await h.controller.listLocalityCommunities({
        appScope: 'app',
        localityType: 'city',
      });
      expect(h.communityService.listLocality).toHaveBeenCalledWith(
        'app',
        'city'
      );

      await h.controller.getSubCommunities({ parentId: 'c1' });
      expect(h.communityService.getSubCommunities).toHaveBeenCalledWith('c1');

      await h.controller.findAllCommunities({
        criteria: { name: 'x' } as never,
        appScope: 'app',
      });
      expect(h.communityService.findAll).toHaveBeenCalledWith(
        { name: 'x' },
        'app'
      );

      await h.controller.getTopActiveCommunities({
        limit: 5,
        appScope: 'app',
      });
      expect(h.communityService.getTopActive).toHaveBeenCalledWith(5, 'app');

      await h.controller.updateCommunity({
        id: 'c1',
        dto: { name: 'new' } as never,
        userId: 'u1',
      });
      expect(h.communityService.update).toHaveBeenCalledWith(
        'c1',
        { name: 'new' },
        'u1'
      );

      await h.controller.joinCommunity({
        dto: { communityId: 'c1' } as never,
        userId: 'u1',
        profileId: 'pr1',
      });
      expect(h.communityService.join).toHaveBeenCalledWith(
        { communityId: 'c1' },
        'u1',
        'pr1'
      );

      await expect(h.controller.getCommunityMembers('c1')).resolves.toEqual([
        { id: 'm1' },
      ]);
      await expect(
        h.controller.isCommunityMember({ communityId: 'c1', userId: 'u1' })
      ).resolves.toBe(true);

      await h.controller.getUserCommunities({
        userId: 'u1',
        appScope: 'app',
      });
      expect(h.communityService.getUserCommunities).toHaveBeenCalledWith(
        'u1',
        'app'
      );

      await h.controller.getCommunitiesByProfileId({
        profileId: 'pr1',
        appScope: 'app',
      });
      expect(h.communityService.getCommunitiesByProfileId).toHaveBeenCalledWith(
        'pr1',
        'app'
      );
    });

    it('reports success for the void community mutations', async () => {
      await expect(
        h.controller.deleteCommunity({ id: 'c1', userId: 'u1' })
      ).resolves.toEqual({ success: true });
      expect(h.communityService.delete).toHaveBeenCalledWith('c1', 'u1');

      await expect(
        h.controller.leaveCommunity({ communityId: 'c1', userId: 'u1' })
      ).resolves.toEqual({ success: true });
      expect(h.communityService.leave).toHaveBeenCalledWith('c1', 'u1');

      await expect(
        h.controller.cancelInvite({ inviteId: 'i1', userId: 'u1' })
      ).resolves.toEqual({ success: true });
      expect(h.communityService.cancelInvite).toHaveBeenCalledWith('i1', 'u1');

      await expect(
        h.controller.rejectMember({ memberId: 'm1', rejecterId: 'u1' })
      ).resolves.toEqual({ success: true });
      expect(h.communityService.rejectMember).toHaveBeenCalledWith('m1', 'u1');

      await expect(
        h.controller.removeMember({ memberId: 'm1', removerId: 'u1' })
      ).resolves.toEqual({ success: true });
      expect(h.communityService.removeMember).toHaveBeenCalledWith('m1', 'u1');

      await expect(
        h.controller.setCommunityChatRoom({
          communityId: 'c1',
          chatRoomId: 'room-1',
        })
      ).resolves.toEqual({ success: true });
      expect(h.communityService.setCommunityChatRoom).toHaveBeenCalledWith(
        'c1',
        'room-1'
      );
    });

    it('delegates membership and invitation management', async () => {
      h.communityService.invite.mockResolvedValue({ id: 'i1' });
      h.communityService.getPendingInvites.mockResolvedValue([{ id: 'i1' }]);
      h.communityService.getPendingJoinRequests.mockResolvedValue([
        { id: 'm1' },
      ]);
      h.communityService.approveMember.mockResolvedValue({ id: 'm1' });
      h.communityService.updateMemberRole.mockResolvedValue({ id: 'm1' });
      h.communityService.getCommunityChatRoom.mockResolvedValue('room-1');

      await h.controller.inviteToCommunity({
        dto: { communityId: 'c1' } as never,
        inviterId: 'u1',
      });
      expect(h.communityService.invite).toHaveBeenCalledWith(
        { communityId: 'c1' },
        'u1'
      );

      await h.controller.getPendingInvites({
        communityId: 'c1',
        userId: 'u1',
      });
      expect(h.communityService.getPendingInvites).toHaveBeenCalledWith(
        'c1',
        'u1'
      );

      await h.controller.getPendingJoinRequests({
        communityId: 'c1',
        userId: 'u1',
      });
      expect(h.communityService.getPendingJoinRequests).toHaveBeenCalledWith(
        'c1',
        'u1'
      );

      await h.controller.approveMember({
        memberId: 'm1',
        approverId: 'u1',
      });
      expect(h.communityService.approveMember).toHaveBeenCalledWith('m1', 'u1');

      await h.controller.updateMemberRole({
        communityId: 'c1',
        memberId: 'm1',
        role: 'moderator' as never,
        userId: 'u1',
      });
      expect(h.communityService.updateMemberRole).toHaveBeenCalledWith(
        'm1',
        'moderator',
        'u1'
      );

      await expect(
        h.controller.getCommunityChatRoom({ communityId: 'c1' })
      ).resolves.toBe('room-1');
    });

    it('delegates the election and manager surface', async () => {
      h.communityService.getCommunityManager.mockResolvedValue({ id: 'm1' });
      h.communityService.getActiveElection.mockResolvedValue({ id: 'e1' });
      h.communityService.startElection.mockResolvedValue({ id: 'e1' });
      h.communityService.nominateForElection.mockResolvedValue({ id: 'cand' });
      h.communityService.voteInElection.mockResolvedValue({ id: 'v1' });
      h.communityService.closeElection.mockResolvedValue({ id: 'e1' });
      h.communityService.withdrawCandidate.mockResolvedValue({ id: 'cand' });
      h.communityService.appointManager.mockResolvedValue({ id: 'm1' });
      h.communityService.revokeManager.mockResolvedValue({ id: 'c1' });

      const endsAt = new Date('2030-01-01');

      await expect(
        h.controller.getCommunityManager({ communityId: 'c1' })
      ).resolves.toEqual({ id: 'm1' });
      await expect(
        h.controller.getCommunityElection({ communityId: 'c1' })
      ).resolves.toEqual({ id: 'e1' });

      await h.controller.startElection({
        communityId: 'c1',
        initiatedBy: 'u1',
        endsAt,
      });
      expect(h.communityService.startElection).toHaveBeenCalledWith(
        'c1',
        'u1',
        endsAt
      );

      await h.controller.nominateForElection({
        communityId: 'c1',
        userId: 'u1',
        profileId: 'pr1',
      });
      expect(h.communityService.nominateForElection).toHaveBeenCalledWith(
        'c1',
        'u1',
        'pr1'
      );

      await h.controller.voteInElection({
        communityId: 'c1',
        voterId: 'u1',
        voterProfileId: 'pr1',
        candidateId: 'cand',
      });
      expect(h.communityService.voteInElection).toHaveBeenCalledWith(
        'c1',
        'u1',
        'pr1',
        'cand'
      );

      await h.controller.closeElection({ electionId: 'e1' });
      expect(h.communityService.closeElection).toHaveBeenCalledWith('e1');

      await h.controller.withdrawFromElection({
        communityId: 'c1',
        userId: 'u1',
      });
      expect(h.communityService.withdrawCandidate).toHaveBeenCalledWith(
        'c1',
        'u1'
      );

      await h.controller.appointManager({
        communityId: 'c1',
        userId: 'u1',
        profileId: 'pr1',
      });
      expect(h.communityService.appointManager).toHaveBeenCalledWith(
        'c1',
        'u1',
        'pr1'
      );

      await h.controller.revokeManager({ communityId: 'c1' });
      expect(h.communityService.revokeManager).toHaveBeenCalledWith('c1');
    });
  });

  describe('community feed', () => {
    it('returns an empty feed when no source is selected', async () => {
      const result = await h.controller.getCommunityFeed({
        userId: 'u1',
        profileId: 'pr1',
        appScope: 'app',
        includePublic: false,
      });

      expect(result).toEqual([]);
      expect(h.queryBuilder.getMany).not.toHaveBeenCalled();
    });

    it('builds a query from the selected sources, caps the limit and hydrates posts', async () => {
      h.followService.getFollowing.mockResolvedValue([
        { followeeId: 'followed-1' },
      ]);
      h.communityService.getUserCommunities.mockResolvedValue([{ id: 'c1' }]);
      h.queryBuilder.getMany.mockResolvedValue([
        { id: 'p1', profileId: 'author-1' },
        { id: 'p2', profileId: 'blocked-1' },
      ]);
      h.privacyService.getBlockedUsers.mockResolvedValue([
        { blockedId: 'blocked-1' },
      ]);
      h.voteService.findAll.mockResolvedValue([{ id: 'v1' }]);
      h.commentService.findAll.mockResolvedValue([{ id: 'c1' }]);
      h.attachmentService.findAll.mockResolvedValue([{ id: 'a1' }]);

      const result = await h.controller.getCommunityFeed({
        userId: 'u1',
        profileId: 'pr1',
        appScope: 'app',
        includeFollowing: true,
        includeCommunities: true,
        limit: 1000,
        offset: 5,
      });

      const [where, params] = h.queryBuilder.where.mock.calls[0];
      expect(where).toContain('post.visibility = :public');
      expect(where).toContain('post.userId IN (:...followingIds)');
      expect(where).toContain('post.communityId IN (:...communityIds)');
      expect(params.followingIds).toEqual(['followed-1']);
      expect(params.communityIds).toEqual(['c1']);
      expect(h.queryBuilder.skip).toHaveBeenCalledWith(5);
      expect(h.queryBuilder.take).toHaveBeenCalledWith(100);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p1');
      expect(result[0].votes).toEqual([{ id: 'v1' }]);
    });
  });

  describe('notifications', () => {
    it('delegates the notification surface', async () => {
      h.notificationService.create.mockResolvedValue({ id: 'n1' });
      h.notificationService.findOne.mockResolvedValue({ id: 'n1' });
      h.notificationService.findByRecipient.mockResolvedValue([{ id: 'n1' }]);
      h.notificationService.getUnreadCount.mockResolvedValue(3);

      const payload = {
        recipientId: 'r1',
        type: 'like',
        title: 't',
        body: 'b',
      };
      await expect(h.controller.createNotification(payload)).resolves.toEqual({
        id: 'n1',
      });
      expect(h.notificationService.create).toHaveBeenCalledWith(payload);

      await expect(h.controller.findNotification('n1')).resolves.toEqual({
        id: 'n1',
      });
      await expect(
        h.controller.findNotificationsByRecipient('r1')
      ).resolves.toEqual([{ id: 'n1' }]);

      await expect(h.controller.markNotificationRead('n1')).resolves.toEqual({
        success: true,
      });
      expect(h.notificationService.markAsRead).toHaveBeenCalledWith('n1');

      await expect(
        h.controller.markAllNotificationsRead('r1')
      ).resolves.toEqual({ success: true });
      expect(h.notificationService.markAllAsRead).toHaveBeenCalledWith('r1');

      await expect(h.controller.deleteNotification('n1')).resolves.toEqual({
        success: true,
      });
      expect(h.notificationService.delete).toHaveBeenCalledWith('n1');

      await expect(
        h.controller.getUnreadNotificationCount('r1')
      ).resolves.toEqual({ count: 3 });
    });
  });

  describe('search', () => {
    it('delegates the search surface', async () => {
      h.searchService.search.mockResolvedValue({ posts: [] });
      h.searchService.getTrending.mockResolvedValue(['tag']);
      h.searchService.getSuggestedUsers.mockResolvedValue(['u']);
      h.searchService.getSuggestedCommunities.mockResolvedValue(['c']);
      h.searchService.getSearchHistory.mockResolvedValue(['q']);

      await h.controller.search({
        query: 'hello',
        options: { type: 'post' },
        profileId: 'pr1',
      });
      expect(h.searchService.search).toHaveBeenCalledWith(
        'hello',
        { type: 'post' },
        'pr1'
      );

      await h.controller.getTrending({ limit: 5, profileId: 'pr1' });
      expect(h.searchService.getTrending).toHaveBeenCalledWith(5, 'pr1');

      await h.controller.getSuggestedUsers({ limit: 5, profileId: 'pr1' });
      expect(h.searchService.getSuggestedUsers).toHaveBeenCalledWith(5, 'pr1');

      await h.controller.getSuggestedCommunities({ limit: 5 });
      expect(h.searchService.getSuggestedCommunities).toHaveBeenCalledWith(5);

      await h.controller.getSearchHistory({ profileId: 'pr1', limit: 5 });
      expect(h.searchService.getSearchHistory).toHaveBeenCalledWith('pr1', 5);
    });
  });

  describe('privacy and moderation', () => {
    it('delegates blocking and muting', async () => {
      h.privacyService.blockUser.mockResolvedValue({ id: 'b1' });
      h.privacyService.isUserBlocked.mockResolvedValue(true);
      h.privacyService.muteUser.mockResolvedValue({ id: 'mu1' });
      h.privacyService.getMutedUsers.mockResolvedValue([{ id: 'mu1' }]);
      h.privacyService.getBlockedUsers.mockResolvedValue([{ id: 'b1' }]);

      await h.controller.blockUser({
        blockerId: 'a',
        blockedId: 'b',
        reason: 'spam',
      });
      expect(h.privacyService.blockUser).toHaveBeenCalledWith('a', 'b', 'spam');

      await expect(
        h.controller.unblockUser({ blockerId: 'a', blockedId: 'b' })
      ).resolves.toEqual({ success: true });
      expect(h.privacyService.unblockUser).toHaveBeenCalledWith('a', 'b');

      await expect(
        h.controller.getBlockedUsers({ blockerId: 'a' })
      ).resolves.toEqual([{ id: 'b1' }]);

      await expect(
        h.controller.isUserBlocked({ blockerId: 'a', blockedId: 'b' })
      ).resolves.toBe(true);

      await h.controller.muteUser({
        muterId: 'a',
        mutedId: 'b',
        duration: 60,
      });
      expect(h.privacyService.muteUser).toHaveBeenCalledWith('a', 'b', 60);

      await expect(
        h.controller.unmuteUser({ muterId: 'a', mutedId: 'b' })
      ).resolves.toEqual({ success: true });
      expect(h.privacyService.unmuteUser).toHaveBeenCalledWith('a', 'b');

      await expect(
        h.controller.getMutedUsers({ muterId: 'a' })
      ).resolves.toEqual([{ id: 'mu1' }]);
    });

    it('delegates reporting and moderation', async () => {
      h.privacyService.reportContent.mockResolvedValue({ id: 'rep1' });
      h.privacyService.getMyReports.mockResolvedValue([{ id: 'rep1' }]);
      h.privacyService.getAllReports.mockResolvedValue([{ id: 'rep1' }]);
      h.privacyService.updateReportStatus.mockResolvedValue({ id: 'rep1' });
      h.privacyService.moderateContent.mockResolvedValue({ id: 'p1' });

      await h.controller.reportContent({
        reporterId: 'a',
        contentType: 'post',
        contentId: 'p1',
        reason: 'spam',
        description: 'details',
      });
      expect(h.privacyService.reportContent).toHaveBeenCalledWith(
        'a',
        'post',
        'p1',
        'spam',
        'details'
      );

      await expect(
        h.controller.getMyReports({ reporterId: 'a' })
      ).resolves.toEqual([{ id: 'rep1' }]);
      await expect(h.controller.getAllReports()).resolves.toEqual([
        { id: 'rep1' },
      ]);

      await h.controller.updateReportStatus({
        id: 'rep1',
        status: 'reviewed',
        adminNotes: 'looked at it',
      });
      expect(h.privacyService.updateReportStatus).toHaveBeenCalledWith(
        'rep1',
        'reviewed',
        'looked at it'
      );

      await h.controller.moderateContent({
        contentType: 'post',
        contentId: 'p1',
        moderationStatus: 'hidden',
        moderatedBy: 'admin',
        adminNotes: 'nope',
      });
      expect(h.privacyService.moderateContent).toHaveBeenCalledWith(
        'post',
        'p1',
        'hidden',
        'admin',
        'nope'
      );
    });
  });

  describe('activities and saved items', () => {
    it('delegates the activity surface', async () => {
      h.activityService.createActivity.mockResolvedValue({ id: 'act1' });
      h.activityService.findOne.mockResolvedValue({ id: 'act1' });
      h.activityService.findByProfile.mockResolvedValue([{ id: 'act1' }]);

      const payload = {
        profileId: 'pr1',
        type: 'post',
        description: 'did a thing',
      };
      await expect(h.controller.createActivity(payload)).resolves.toEqual({
        id: 'act1',
      });
      expect(h.activityService.createActivity).toHaveBeenCalledWith(payload);

      await expect(h.controller.findActivity('act1')).resolves.toEqual({
        id: 'act1',
      });

      await h.controller.findActivitiesByProfile({
        profileId: 'pr1',
        type: 'post',
        limit: 5,
        offset: 2,
      });
      expect(h.activityService.findByProfile).toHaveBeenCalledWith('pr1', {
        type: 'post',
        limit: 5,
        offset: 2,
      });

      await expect(h.controller.deleteActivity('act1')).resolves.toEqual({
        success: true,
      });
      expect(h.activityService.deleteActivity).toHaveBeenCalledWith('act1');
    });

    it('delegates the saved item surface', async () => {
      h.activityService.saveItem.mockResolvedValue({ id: 'si1' });
      h.activityService.findSavedItems.mockResolvedValue([{ id: 'si1' }]);
      h.activityService.isItemSaved.mockResolvedValue(true);

      await h.controller.saveItem({
        profileId: 'pr1',
        itemType: 'post',
        itemId: 'p1',
        itemTitle: 'Title',
      });
      expect(h.activityService.saveItem).toHaveBeenCalledWith(
        'pr1',
        'post',
        'p1',
        'Title'
      );

      await expect(
        h.controller.unsaveItem({ profileId: 'pr1', itemId: 'p1' })
      ).resolves.toEqual({ success: true });
      expect(h.activityService.unsaveItem).toHaveBeenCalledWith('pr1', 'p1');

      await expect(h.controller.findSavedItems('pr1')).resolves.toEqual([
        { id: 'si1' },
      ]);
      await expect(
        h.controller.isItemSaved({ profileId: 'pr1', itemId: 'p1' })
      ).resolves.toBe(true);
    });
  });

  describe('presence', () => {
    it('delegates the presence surface', async () => {
      h.presenceService.setPresence.mockResolvedValue({ status: 'online' });
      h.presenceService.getPresence.mockResolvedValue({ status: 'online' });
      h.presenceService.getPresenceBatch.mockResolvedValue([
        { status: 'online' },
      ]);
      h.presenceService.getOnlineUsers.mockResolvedValue(['u1']);

      await h.controller.setPresence({
        userId: 'u1',
        status: 'online' as never,
      });
      expect(h.presenceService.setPresence).toHaveBeenCalledWith(
        'u1',
        'online'
      );

      await expect(h.controller.getPresence('u1')).resolves.toEqual({
        status: 'online',
      });
      await expect(
        h.controller.getPresenceBatch(['u1', 'u2'])
      ).resolves.toEqual([{ status: 'online' }]);
      await expect(h.controller.getOnlineUsers()).resolves.toEqual(['u1']);

      await expect(h.controller.updateLastSeen('u1')).resolves.toEqual({
        success: true,
      });
      expect(h.presenceService.updateLastSeen).toHaveBeenCalledWith('u1');

      await expect(h.controller.setOffline('u1')).resolves.toEqual({
        success: true,
      });
      expect(h.presenceService.setOffline).toHaveBeenCalledWith('u1');
    });
  });

  describe('profile analytics', () => {
    it('delegates the analytics surface', async () => {
      h.profileAnalyticsService.recordView.mockResolvedValue({ id: 'pv1' });
      h.profileAnalyticsService.getViewStats.mockResolvedValue({ total: 3 });
      h.profileAnalyticsService.getRecentViewers.mockResolvedValue(['v1']);

      await h.controller.recordProfileView({
        profileId: 'pr1',
        viewerId: 'v1',
        source: 'feed',
      });
      expect(h.profileAnalyticsService.recordView).toHaveBeenCalledWith(
        'pr1',
        'v1',
        'feed'
      );

      await expect(h.controller.getProfileViewStats('pr1')).resolves.toEqual({
        total: 3,
      });

      await h.controller.getRecentProfileViewers({
        profileId: 'pr1',
        limit: 5,
      });
      expect(h.profileAnalyticsService.getRecentViewers).toHaveBeenCalledWith(
        'pr1',
        5
      );
    });
  });

  describe('polls', () => {
    it('delegates the poll surface', async () => {
      h.pollService.create.mockResolvedValue({ id: 'poll1' });
      h.pollService.update.mockResolvedValue({ id: 'poll1' });
      h.pollService.findOne.mockResolvedValue({ id: 'poll1' });
      h.pollService.findMany.mockResolvedValue([{ id: 'poll1' }]);
      h.pollService.vote.mockResolvedValue({ id: 'poll1' });
      h.pollService.removeVote.mockResolvedValue({ id: 'poll1' });

      const createDto = { question: 'q?' };
      await expect(
        h.controller.createPoll(createDto as never)
      ).resolves.toEqual({ id: 'poll1' });
      expect(h.pollService.create).toHaveBeenCalledWith(createDto);

      await h.controller.updatePoll('poll1', { question: 'q2?' } as never);
      expect(h.pollService.update).toHaveBeenCalledWith('poll1', {
        question: 'q2?',
      });

      await expect(h.controller.deletePoll('poll1')).resolves.toEqual({
        success: true,
      });
      expect(h.pollService.remove).toHaveBeenCalledWith('poll1');

      await expect(h.controller.findPoll('poll1')).resolves.toEqual({
        id: 'poll1',
      });
      await expect(h.controller.findManyPolls('pr1')).resolves.toEqual([
        { id: 'poll1' },
      ]);

      const voteDto = { pollId: 'poll1', optionId: 'o1' };
      await h.controller.votePoll(voteDto as never);
      expect(h.pollService.vote).toHaveBeenCalledWith(voteDto);

      await h.controller.removeVotePoll('poll1', 'u1');
      expect(h.pollService.removeVote).toHaveBeenCalledWith('poll1', 'u1');
    });
  });

  describe('post shares', () => {
    it('delegates the post share surface', async () => {
      h.postShareService.create.mockResolvedValue({ id: 'ps1' });
      h.postShareService.findByPost.mockResolvedValue([{ id: 'ps1' }]);
      h.postShareService.findByProfile.mockResolvedValue([{ id: 'ps1' }]);

      const dto = { originalPostId: 'p1', sharedById: 'pr1' };
      await expect(h.controller.createPostShare(dto as never)).resolves.toEqual(
        { id: 'ps1' }
      );
      expect(h.postShareService.create).toHaveBeenCalledWith(dto);

      await expect(h.controller.deletePostShare('ps1')).resolves.toEqual({
        success: true,
      });
      expect(h.postShareService.remove).toHaveBeenCalledWith('ps1');

      await expect(h.controller.findPostSharesByPost('p1')).resolves.toEqual([
        { id: 'ps1' },
      ]);
      await expect(
        h.controller.findPostSharesByProfile('pr1')
      ).resolves.toEqual([{ id: 'ps1' }]);
    });
  });

  describe('events', () => {
    it('delegates the event surface', async () => {
      h.eventService.create.mockResolvedValue({ id: 'e1' });
      h.eventService.update.mockResolvedValue({ id: 'e1' });
      h.eventService.findOne.mockResolvedValue({ id: 'e1' });
      h.eventService.findMany.mockResolvedValue([{ id: 'e1' }]);
      h.eventService.findUpcoming.mockResolvedValue([{ id: 'e1' }]);
      h.eventService.attend.mockResolvedValue({ id: 'att1' });
      h.eventService.unattend.mockResolvedValue({ success: true });
      h.eventService.isAttending.mockResolvedValue(true);

      const dto = { title: 'Meetup' };
      await expect(h.controller.createEvent(dto as never)).resolves.toEqual({
        id: 'e1',
      });
      expect(h.eventService.create).toHaveBeenCalledWith(dto);

      await h.controller.updateEvent('e1', { title: 'New' } as never);
      expect(h.eventService.update).toHaveBeenCalledWith('e1', {
        title: 'New',
      });

      await expect(h.controller.deleteEvent('e1')).resolves.toEqual({
        success: true,
      });
      expect(h.eventService.remove).toHaveBeenCalledWith('e1');

      await expect(h.controller.findEvent('e1')).resolves.toEqual({ id: 'e1' });

      const options = { profileId: 'pr1', upcoming: true };
      await h.controller.findManyEvents(options);
      expect(h.eventService.findMany).toHaveBeenCalledWith(options);

      await h.controller.findUpcomingEvents(undefined as never);
      expect(h.eventService.findUpcoming).toHaveBeenCalledWith(10);

      await expect(h.controller.attendEvent('e1', 'pr1')).resolves.toEqual({
        id: 'att1',
      });
      await expect(h.controller.unattendEvent('e1', 'pr1')).resolves.toEqual({
        success: true,
      });
      await expect(h.controller.isAttendingEvent('e1', 'pr1')).resolves.toBe(
        true
      );
    });
  });

  describe('scheduled posts', () => {
    it('normalises scheduledAt into a Date on create', async () => {
      h.postService.createScheduledPost.mockResolvedValue({ id: 'sp1' });

      await h.controller.createScheduledPost({
        title: 't',
        content: 'c',
        profileId: 'pr1',
        userId: 'u1',
        scheduledAt: '2030-01-01T00:00:00.000Z',
        visibility: 'public',
        communityId: 'c1',
        attachmentIds: ['a1'],
      } as never);

      const arg = h.postService.createScheduledPost.mock.calls[0][0];
      expect(arg.scheduledAt).toBeInstanceOf(Date);
      expect(arg.scheduledAt.toISOString()).toBe('2030-01-01T00:00:00.000Z');
      expect(arg.attachmentIds).toEqual(['a1']);
    });

    it('leaves scheduledAt undefined on update when it is not supplied', async () => {
      h.postService.updateScheduledPost.mockResolvedValue({ id: 'sp1' });

      await h.controller.updateScheduledPost('sp1', {
        title: 't',
      } as never);

      const [id, arg] = h.postService.updateScheduledPost.mock.calls[0];
      expect(id).toBe('sp1');
      expect(arg.scheduledAt).toBeUndefined();

      await h.controller.updateScheduledPost('sp1', {
        scheduledAt: '2030-02-02T00:00:00.000Z',
      } as never);
      expect(
        h.postService.updateScheduledPost.mock.calls[1][1].scheduledAt
      ).toBeInstanceOf(Date);
    });

    it('delegates the remaining scheduled post commands', async () => {
      h.postService.findOne.mockResolvedValue({ id: 'sp1' });
      h.postService.findScheduledPosts.mockResolvedValue([{ id: 'sp1' }]);
      h.postService.publishScheduledPost.mockResolvedValue({ id: 'sp1' });

      await expect(h.controller.deleteScheduledPost('sp1')).resolves.toEqual({
        success: true,
      });
      expect(h.postService.deleteScheduledPost).toHaveBeenCalledWith('sp1');

      await expect(h.controller.findScheduledPost('sp1')).resolves.toEqual({
        id: 'sp1',
      });
      await expect(h.controller.findManyScheduledPosts('pr1')).resolves.toEqual(
        [{ id: 'sp1' }]
      );
      await expect(h.controller.publishScheduledPost('sp1')).resolves.toEqual({
        id: 'sp1',
      });
    });
  });
});
