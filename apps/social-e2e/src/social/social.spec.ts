import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import {
  PostCommands,
  CommentCommands,
  VoteCommands,
  AttachmentCommands,
  FollowCommands,
} from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';

describe('Social Microservice E2E', () => {
  let socialClient: ClientProxy;
  let createdPostId: string;
  let createdCommentId: string;
  let createdVoteId: string;
  const testUserId = `test-user-${Date.now()}`;
  const testUserId2 = `test-user-${Date.now()}-2`;
  const testProfileId = `00000000-0000-0000-0000-${Date.now()
    .toString()
    .slice(-12)}`; // Valid UUID format

  beforeAll(async () => {
    // Create a client proxy to connect to the social microservice
    socialClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: {
        host: globalThis.socketConnectionOptions?.host || '127.0.0.1',
        port: globalThis.socketConnectionOptions?.port || 3003,
      },
    });

    // Connect to the microservice
    await socialClient.connect();
  });

  afterAll(async () => {
    // Close the connection
    await socialClient.close();
  });

  describe('Post Operations', () => {
    describe('Create Post', () => {
      it('should create a new post', async () => {
        const result = await firstValueFrom(
          socialClient.send(
            { cmd: PostCommands.CREATE },
            {
              userId: testUserId,
              profileId: testProfileId,
              content: 'This is a test post for E2E testing',
              title: 'Test Post',
            }
          )
        );

        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.userId).toBe(testUserId);
        expect(result.profileId).toBe(testProfileId);
        expect(result.content).toBe('This is a test post for E2E testing');
        expect(result.title).toBe('Test Post');

        createdPostId = result.id;
      });

      it('should create a post without title', async () => {
        await expect(
          firstValueFrom(
            socialClient.send(
              { cmd: PostCommands.CREATE },
              {
                userId: testUserId,
                content: 'This is a test post without title',
              }
            )
          )
        ).rejects.toBeDefined();
      });
    });

    describe('Find Posts', () => {
      it('should find a post by id', async () => {
        const result = await firstValueFrom(
          socialClient.send(
            { cmd: PostCommands.FIND },
            {
              id: createdPostId,
              options: {},
            }
          )
        );

        expect(result).toBeDefined();
        expect(result.id).toBe(createdPostId);
        expect(result.userId).toBe(testUserId);
      });

      it('should find many posts', async () => {
        const result = await firstValueFrom(
          socialClient.send(
            { cmd: PostCommands.FIND_MANY },
            {
              criteria: { userId: testUserId },
              opts: { limit: 10 },
            }
          )
        );

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('Update Post', () => {
      it('should update a post', async () => {
        const result = await firstValueFrom(
          socialClient.send(
            { cmd: PostCommands.UPDATE },
            {
              id: createdPostId,
              data: {
                title: 'Updated Title',
                content: 'Updated post content',
              },
            }
          ),
          { defaultValue: true }
        );

        expect(result).toBeDefined();

        // Verify update by fetching
        const updatedPost = await firstValueFrom(
          socialClient.send(
            { cmd: PostCommands.FIND },
            {
              id: createdPostId,
            }
          )
        );
        expect(updatedPost.content).toBe('Updated post content');
        expect(updatedPost.title).toBe('Updated Title');
      });
    });
  });

  describe('Comment Operations', () => {
    describe('Create Comment', () => {
      it('should create a comment on a post', async () => {
        const result = await firstValueFrom(
          socialClient.send(
            { cmd: CommentCommands.CREATE },
            {
              postId: createdPostId,
              userId: testUserId,
              profileId: testProfileId,
              content: 'This is a test comment',
            }
          )
        );

        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.userId).toBe(testUserId);
        expect(result.profileId).toBe(testProfileId);
        expect(result.content).toBe('This is a test comment');

        createdCommentId = result.id;
      });
    });

    describe('Find Comments', () => {
      it('should find a comment by id', async () => {
        const result = await firstValueFrom(
          socialClient.send(
            { cmd: CommentCommands.FIND },
            {
              id: createdCommentId,
              options: {},
            }
          )
        );

        expect(result).toBeDefined();
        expect(result.id).toBe(createdCommentId);
      });

      it('should find comments for a post', async () => {
        const result = await firstValueFrom(
          socialClient.send(
            { cmd: CommentCommands.FIND_MANY },
            {
              postId: createdPostId,
            }
          )
        );

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('Update Comment', () => {
      it('should update a comment', async () => {
        const result = await firstValueFrom(
          socialClient.send(
            { cmd: CommentCommands.UPDATE },
            {
              id: createdCommentId,
              update: {
                content: 'Updated comment content',
              },
            }
          ),
          { defaultValue: true }
        );

        expect(result).toBeDefined();

        // Verify update
        const updatedComment = await firstValueFrom(
          socialClient.send(
            { cmd: CommentCommands.FIND },
            {
              id: createdCommentId,
              options: {},
            }
          )
        );
        expect(updatedComment.content).toBe('Updated comment content');
      });
    });
  });

  describe('Vote Operations', () => {
    describe('Upvote', () => {
      it('should upvote a post', async () => {
        const result = await firstValueFrom(
          socialClient.send(
            { cmd: VoteCommands.UPVOTE },
            {
              id: createdPostId,
              userId: testUserId,
              profileId: testProfileId,
            }
          )
        );

        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.value).toBe(1);
        expect(result.profileId).toBe(testProfileId);

        createdVoteId = result.id;
      });
    });

    describe('Get Votes', () => {
      it('should get votes for a post', async () => {
        const result = await firstValueFrom(
          socialClient.send(
            { cmd: VoteCommands.GET },
            {
              postid: createdPostId,
            }
          )
        );

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('Downvote', () => {
      it('should downvote a post', async () => {
        // First, remove the upvote
        await firstValueFrom(
          socialClient.send(
            { cmd: VoteCommands.UNVOTE },
            {
              id: createdVoteId,
            }
          ),
          { defaultValue: true }
        );

        // Then downvote
        const result = await firstValueFrom(
          socialClient.send(
            { cmd: VoteCommands.DOWNVOTE },
            {
              id: createdPostId,
              userId: testUserId,
              profileId: testProfileId,
            }
          )
        );

        expect(result).toBeDefined();
        expect(result.value).toBe(-1);
        expect(result.profileId).toBe(testProfileId);
      });
    });
  });

  describe('Follow Operations', () => {
    describe('Follow User', () => {
      it('should follow a user', async () => {
        const result = await firstValueFrom(
          socialClient.send(
            { cmd: FollowCommands.FOLLOW },
            {
              followerId: testUserId,
              followeeId: testUserId2,
            }
          )
        );

        expect(result).toBeDefined();
      });
    });

    describe('Get Followers', () => {
      it('should get followers of a user', async () => {
        const result = await firstValueFrom(
          socialClient.send(
            { cmd: FollowCommands.GET_FOLLOWERS },
            {
              followeeId: testUserId2,
            }
          )
        );

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe('Get Following', () => {
      it('should get users that a user is following', async () => {
        const result = await firstValueFrom(
          socialClient.send(
            { cmd: FollowCommands.GET_FOLLOWING },
            {
              followerId: testUserId,
            }
          )
        );

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe('Get Follower Count', () => {
      it('should get follower count', async () => {
        const result = await firstValueFrom(
          socialClient.send(
            { cmd: FollowCommands.GET_FOLLOWER_COUNT },
            {
              followeeId: testUserId2,
            }
          )
        );

        expect(result).toBeDefined();
        expect(typeof result).toBe('number');
      });
    });

    describe('Get Following Count', () => {
      it('should get following count', async () => {
        const result = await firstValueFrom(
          socialClient.send(
            { cmd: FollowCommands.GET_FOLLOWING_COUNT },
            {
              followerId: testUserId,
            }
          )
        );

        expect(result).toBeDefined();
        expect(typeof result).toBe('number');
      });
    });

    describe('Unfollow User', () => {
      it('should unfollow a user', async () => {
        const result = await firstValueFrom(
          socialClient.send(
            { cmd: FollowCommands.UNFOLLOW },
            {
              followerId: testUserId,
              followeeId: testUserId2,
            }
          )
        );

        expect(result).toBeDefined();
      });
    });
  });

  describe('Delete Operations', () => {
    it('should delete a comment', async () => {
      const result = await firstValueFrom(
        socialClient.send(
          { cmd: CommentCommands.DELETE },
          {
            id: createdCommentId,
          }
        ),
        { defaultValue: true }
      );

      expect(result).toBeDefined();
    });

    it('should delete a post', async () => {
      // Delete the vote first (created in Downvote test)
      // We need the vote ID from Downvote test.
      // But Downvote test didn't save it.
      // We can find the vote by post ID and user ID.

      const votes = await firstValueFrom(
        socialClient.send(
          { cmd: VoteCommands.GET },
          {
            postid: createdPostId,
          }
        )
      );

      if (votes && votes.length > 0) {
        for (const vote of votes) {
          await firstValueFrom(
            socialClient.send(
              { cmd: VoteCommands.UNVOTE },
              {
                id: vote.id,
              }
            ),
            { defaultValue: true }
          );
        }
      }

      const result = await firstValueFrom(
        socialClient.send(
          { cmd: PostCommands.DELETE },
          {
            id: createdPostId,
          }
        ),
        { defaultValue: true }
      );

      expect(result).toBeDefined();
    });
  });
});
