import { Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  ServiceTokens,
  SocialRealtimeCommands,
  PostCommands,
  CommentCommands,
  VoteCommands,
  FollowCommands,
} from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';
import { Server, Socket } from 'socket.io';
import {
  SocketSessionAuthService,
  SocketSessionUser,
} from '../../auth/socket-session-auth.service';
import { GatewayNotificationRecipientService } from '../../controllers/social/notification/gateway-notification-recipient.service';
import { projectNotification } from '@optimistic-tanuki/social-contracts';

interface ConnectedClient {
  id: string;
  userId: string;
  client: Socket;
  subscriptions: Set<string>;
  contentRevision: number;
}

@WebSocketGateway(Number(process.env.SOCIAL_SOCKET_PORT) || 3301, {
  namespace: 'social',
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: Boolean(process.env.CORS_ORIGIN),
  },
})
export class SocialGateway {
  @WebSocketServer()
  server: Server;

  private readonly l = new Logger(SocialGateway.name);
  private connectedClients: Map<string, Set<ConnectedClient>> = new Map();
  private clientToProfileMap: Map<Socket, string> = new Map();
  private readonly authenticationReady = new WeakMap<
    Socket,
    Promise<SocketSessionUser>
  >();

  constructor(
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy,
    private readonly socketSessionAuth: SocketSessionAuthService,
    private readonly notificationRecipients: GatewayNotificationRecipientService
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const authentication = this.socketSessionAuth.authenticate(client, true);
    this.authenticationReady.set(client, authentication);
    try {
      const user = await authentication;
      if (this.authenticationReady.get(client) !== authentication) {
        return;
      }
      const connectedClient = this.registerClient(
        user.profileId,
        client,
        user.userId
      );
      connectedClient.contentRevision++;
      client.emit('social_content_invalidated', {});
    } catch {
      if (this.authenticationReady.get(client) === authentication) {
        this.authenticationReady.delete(client);
        client.disconnect(true);
      }
    }
  }

  @SubscribeMessage(SocialRealtimeCommands.GET_FEED)
  async handleGetFeed(
    @MessageBody()
    payload: { profileId: string; limit?: number; offset?: number },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    const profileId = (
      await this.assertProfileAfterAuthentication(client, payload.profileId)
    ).profileId;
    this.l.log(`Getting feed for profile: ${profileId}`);

    // Register client if not already registered
    const authenticatedUser = this.socketSessionAuth.getUser(client);
    this.registerClient(profileId, client, authenticatedUser.userId);
    const connectedClient = this.clientToConnectedClient(client)!;
    const contentRevision = connectedClient.contentRevision;

    try {
      // Fetch the feed from social service
      const posts = await firstValueFrom(
        this.socialClient
          .send(
            { cmd: PostCommands.FIND_MANY },
            {
              criteria: {},
              opts: {
                limit: payload.limit || 50,
                offset: payload.offset || 0,
                orderBy: 'createdAt',
                orderDirection: 'DESC',
              },
              viewerProfileId: profileId,
            }
          )
          .pipe(timeout(5000))
      );

      if (
        connectedClient.contentRevision === contentRevision &&
        (await this.isCurrentSocketSession(connectedClient))
      ) {
        client.emit('feed', posts || []);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.l.error(`Error fetching feed: ${errorMessage}`);
      if (await this.isCurrentSocketSessionForClient(client)) {
        client.emit('error', { message: 'Failed to fetch feed' });
      }
    }
  }

  @SubscribeMessage(SocialRealtimeCommands.SUBSCRIBE_POSTS)
  async handleSubscribePosts(
    @MessageBody() payload: { profileId: string; postIds?: string[] },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    const profileId = (
      await this.assertProfileAfterAuthentication(client, payload.profileId)
    ).profileId;
    this.l.log(`User ${profileId} subscribing to posts`);

    const authenticatedUser = this.socketSessionAuth.getUser(client);
    const connectedClient = this.registerClient(
      profileId,
      client,
      authenticatedUser.userId
    );

    if (payload.postIds && payload.postIds.length > 0) {
      const permittedPostIds: string[] = [];
      await Promise.all(
        payload.postIds.map(async (postId) => {
          try {
            const post = await firstValueFrom(
              this.socialClient
                .send(
                  { cmd: PostCommands.FIND },
                  { id: postId, viewerProfileId: profileId }
                )
                .pipe(timeout(3000))
            );
            if (post && !Array.isArray(post)) {
              connectedClient.subscriptions.add(`post:${postId}`);
              permittedPostIds.push(postId);
            }
          } catch {
            // Denied, missing, and unavailable lookups all fail closed.
          }
        })
      );
      if (!(await this.isCurrentSocketSession(connectedClient))) return;
      if (permittedPostIds.length !== payload.postIds.length) {
        client.emit('social_content_invalidated', {});
      }
      client.emit('subscribed', {
        type: 'posts',
        postIds: permittedPostIds,
      });
    } else {
      connectedClient.subscriptions.add('posts:all');
      if (!(await this.isCurrentSocketSession(connectedClient))) return;
      client.emit('subscribed', {
        type: 'posts',
        postIds: ['all'],
      });
    }
  }

  @SubscribeMessage(SocialRealtimeCommands.UNSUBSCRIBE_POSTS)
  async handleUnsubscribePosts(
    @MessageBody() payload: { profileId: string; postIds?: string[] },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    const profileId = (
      await this.assertProfileAfterAuthentication(client, payload.profileId)
    ).profileId;
    this.l.log(`User ${profileId} unsubscribing from posts`);

    const connectedClient = this.clientToConnectedClient(client);
    if (!connectedClient) {
      return;
    }

    if (payload.postIds && payload.postIds.length > 0) {
      payload.postIds.forEach((postId) => {
        connectedClient.subscriptions.delete(`post:${postId}`);
      });
    } else {
      connectedClient.subscriptions.delete('posts:all');
    }

    client.emit('unsubscribed', {
      type: 'posts',
      postIds: payload.postIds || ['all'],
    });
  }

  @SubscribeMessage(SocialRealtimeCommands.SUBSCRIBE_USER_ACTIVITY)
  async handleSubscribeUserActivity(
    @MessageBody() payload: { profileId: string; targetUserIds?: string[] },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    const profileId = (
      await this.assertProfileAfterAuthentication(client, payload.profileId)
    ).profileId;
    this.l.log(`User ${profileId} subscribing to user activity`);

    const authenticatedUser = this.socketSessionAuth.getUser(client);
    const connectedClient = this.registerClient(
      profileId,
      client,
      authenticatedUser.userId
    );

    if (payload.targetUserIds && payload.targetUserIds.length > 0) {
      payload.targetUserIds.forEach((userId) => {
        connectedClient.subscriptions.add(`user:${userId}`);
      });
    } else {
      connectedClient.subscriptions.add(`user:${profileId}`);
    }

    if (!(await this.isCurrentSocketSession(connectedClient))) return;
    client.emit('subscribed', {
      type: 'user_activity',
      userIds: payload.targetUserIds || [profileId],
    });
  }

  @SubscribeMessage(SocialRealtimeCommands.UNSUBSCRIBE_USER_ACTIVITY)
  async handleUnsubscribeUserActivity(
    @MessageBody() payload: { profileId: string; targetUserIds?: string[] },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    const profileId = (
      await this.assertProfileAfterAuthentication(client, payload.profileId)
    ).profileId;
    this.l.log(`User ${profileId} unsubscribing from user activity`);

    const connectedClient = this.clientToConnectedClient(client);
    if (!connectedClient) {
      return;
    }

    if (payload.targetUserIds && payload.targetUserIds.length > 0) {
      payload.targetUserIds.forEach((userId) => {
        connectedClient.subscriptions.delete(`user:${userId}`);
      });
    } else {
      connectedClient.subscriptions.delete(`user:${profileId}`);
    }

    client.emit('unsubscribed', {
      type: 'user_activity',
      userIds: payload.targetUserIds || [profileId],
    });
  }

  @SubscribeMessage(SocialRealtimeCommands.GET_FOLLOWING)
  async handleGetFollowing(
    @MessageBody() payload: { profileId: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    const profileId = (
      await this.assertProfileAfterAuthentication(client, payload.profileId)
    ).profileId;
    this.l.log(`Getting following for profile: ${profileId}`);

    try {
      const following = await firstValueFrom(
        this.socialClient.send(
          { cmd: FollowCommands.GET_FOLLOWING },
          { followerId: profileId }
        )
      );

      if (await this.isCurrentSocketSessionForClient(client)) {
        client.emit('following', following || []);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.l.error(`Error fetching following: ${errorMessage}`);
      if (await this.isCurrentSocketSessionForClient(client)) {
        client.emit('error', { message: 'Failed to fetch following' });
      }
    }
  }

  @SubscribeMessage(SocialRealtimeCommands.GET_FOLLOWERS)
  async handleGetFollowers(
    @MessageBody() payload: { profileId: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    const profileId = (
      await this.assertProfileAfterAuthentication(client, payload.profileId)
    ).profileId;
    this.l.log(`Getting followers for profile: ${profileId}`);

    try {
      const followers = await firstValueFrom(
        this.socialClient.send(
          { cmd: FollowCommands.GET_FOLLOWERS },
          { followeeId: profileId }
        )
      );

      if (await this.isCurrentSocketSessionForClient(client)) {
        client.emit('followers', followers || []);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.l.error(`Error fetching followers: ${errorMessage}`);
      if (await this.isCurrentSocketSessionForClient(client)) {
        client.emit('error', { message: 'Failed to fetch followers' });
      }
    }
  }

  @SubscribeMessage(SocialRealtimeCommands.SUBSCRIBE_NOTIFICATIONS)
  async handleSubscribeNotifications(
    @MessageBody() payload: { profileId: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    const user = await this.assertProfileAfterAuthentication(
      client,
      payload.profileId
    );
    const profileId = await this.notificationRecipients.assertSelected(
      user,
      payload.profileId
    );
    this.l.log(`User ${profileId} subscribing to notifications`);

    const authenticatedUser = this.socketSessionAuth.getUser(client);
    const connectedClient = this.registerClient(
      profileId,
      client,
      authenticatedUser.userId
    );
    connectedClient.subscriptions.add(`notifications:${profileId}`);

    if (!(await this.isCurrentSocketSession(connectedClient))) return;
    client.emit('subscribed', {
      type: 'notifications',
      profileId,
    });
  }

  @SubscribeMessage(SocialRealtimeCommands.UNSUBSCRIBE_NOTIFICATIONS)
  async handleUnsubscribeNotifications(
    @MessageBody() payload: { profileId: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    const user = await this.assertProfileAfterAuthentication(
      client,
      payload.profileId
    );
    const profileId = await this.notificationRecipients.assertSelected(
      user,
      payload.profileId
    );
    this.l.log(`User ${profileId} unsubscribing from notifications`);

    const connectedClient = this.clientToConnectedClient(client);
    if (!connectedClient) {
      return;
    }

    connectedClient.subscriptions.delete(`notifications:${profileId}`);

    client.emit('unsubscribed', {
      type: 'notifications',
      profileId,
    });
  }

  @SubscribeMessage('disconnect')
  handleDisconnect(@ConnectedSocket() client: Socket): void {
    this.authenticationReady.delete(client);
    this.removeClient(client);
  }

  private removeClient(client: Socket): void {
    // Use reverse mapping for efficient lookup
    const profileId = this.clientToProfileMap.get(client);

    if (profileId) {
      const clients = this.connectedClients.get(profileId);
      const connected = this.clientToConnectedClient(client);
      if (connected) {
        clients?.delete(connected);
      }
      if (clients?.size === 0) this.connectedClients.delete(profileId);
      this.clientToProfileMap.delete(client);
    }
  }

  // Helper methods for broadcasting updates
  async broadcastPostCreated(post: any): Promise<void> {
    this.l.log(`Broadcasting post created: ${post.id}`);
    this.advanceRealtimeFeedRevision();
    await this.broadcastAuthorizedPost(
      'posts:all',
      'post_created',
      post.id,
      post
    );
  }

  async broadcastPostUpdated(post: any): Promise<void> {
    this.l.log(`Broadcasting post updated: ${post.id}`);
    // Any post update can change feed eligibility (audience, moderation,
    // scheduling, or community scope). Advance in-flight feed reads and make
    // active clients fetch the current authorized snapshot before applying
    // per-post updates.
    await this.broadcastSocialContentInvalidated();
    await this.broadcastAuthorizedPost(
      `post:${post.id}`,
      'post_updated',
      post.id,
      post
    );
    await this.broadcastAuthorizedPost(
      'posts:all',
      'post_updated',
      post.id,
      post
    );
  }

  async broadcastPostDeleted(postId: string): Promise<void> {
    this.l.log(`Broadcasting post deleted: ${postId}`);
    await this.broadcastSocialContentInvalidated();
  }

  async broadcastCommentCreated(comment: any): Promise<void> {
    const postId = this.relatedPostId(comment);
    if (!postId) {
      await this.broadcastSocialContentInvalidated();
      return;
    }
    this.l.log(`Broadcasting comment created on post: ${postId}`);
    await this.broadcastAuthorizedPost(
      `post:${postId}`,
      'comment_created',
      postId,
      comment
    );
  }

  async broadcastCommentUpdated(comment: any): Promise<void> {
    const postId = this.relatedPostId(comment);
    if (!postId) {
      await this.broadcastSocialContentInvalidated();
      return;
    }
    this.l.log(`Broadcasting comment updated: ${comment.id}`);
    await this.broadcastAuthorizedPost(
      `post:${postId}`,
      'comment_updated',
      postId,
      comment
    );
  }

  async broadcastCommentDeleted(
    commentId: string,
    postId: string
  ): Promise<void> {
    if (!this.isValidPostId(postId)) {
      await this.broadcastSocialContentInvalidated();
      return;
    }
    this.l.log(`Broadcasting comment deleted: ${commentId}`);
    await this.broadcastAuthorizedPost(
      `post:${postId}`,
      'comment_deleted',
      postId,
      {
        commentId,
        postId,
      }
    );
  }

  async broadcastVoteUpdated(vote: any): Promise<void> {
    const postId = this.relatedPostId(vote);
    if (!postId) {
      await this.broadcastSocialContentInvalidated();
      return;
    }
    this.l.log(`Broadcasting vote updated on post: ${postId}`);
    await this.broadcastAuthorizedPost(
      `post:${postId}`,
      'vote_updated',
      postId,
      vote
    );
  }

  /** Invalidate client content without disclosing which restricted resource changed. */
  async broadcastSocialContentInvalidated(): Promise<void> {
    const recipients = Array.from(this.connectedClients.values()).flatMap(
      (clients) => Array.from(clients)
    );
    await Promise.all(
      recipients.map(async (connected) => {
        if (!(await this.isCurrentSocketSession(connected))) return;
        connected.contentRevision++;
        connected.client.emit('social_content_invalidated', {});
      })
    );
  }

  private async broadcastAuthorizedPost(
    subscription: string,
    event: string,
    postId: string,
    payload: any
  ): Promise<void> {
    if (!this.isValidPostId(postId)) {
      await this.broadcastSocialContentInvalidated();
      return;
    }
    const recipients = Array.from(this.connectedClients.values())
      .flatMap((clients) => Array.from(clients))
      .filter((entry) => entry.subscriptions.has(subscription));
    await Promise.all(
      recipients.map(async (connected) => {
        const { id, client, contentRevision } = connected;
        try {
          if (!(await this.isCurrentSocketSession(connected))) return;
          const post = await firstValueFrom(
            this.socialClient
              .send(
                { cmd: PostCommands.FIND },
                { id: postId, viewerProfileId: id }
              )
              .pipe(timeout(3000))
          );
          const authorized = !!post && !Array.isArray(post);
          const revisionCurrent = connected.contentRevision === contentRevision;
          if (!(await this.isCurrentSocketSession(connected))) return;
          if (authorized && revisionCurrent) {
            client.emit(
              event,
              event.startsWith('comment_') || event === 'vote_updated'
                ? payload
                : post
            );
          } else {
            client.emit('social_content_invalidated', {});
          }
        } catch {
          if (await this.isCurrentSocketSession(connected)) {
            client.emit('social_content_invalidated', {});
          }
        }
      })
    );
  }

  private relatedPostId(resource: any): string | undefined {
    const postId =
      resource?.postId ?? resource?.post?.id ?? resource?.comment?.post?.id;
    return this.isValidPostId(postId) ? postId : undefined;
  }

  private isValidPostId(postId: unknown): postId is string {
    return typeof postId === 'string' && postId.trim().length > 0;
  }

  async broadcastFollowEvent(
    followerId: string,
    followeeId: string,
    action: 'follow' | 'unfollow'
  ): Promise<void> {
    this.l.log(`Broadcasting ${action} event: ${followerId} -> ${followeeId}`);
    await this.broadcastToSubscribers(`user:${followeeId}`, `user_${action}`, {
      followerId,
      followeeId,
    });
    await this.broadcastToSubscribers(`user:${followerId}`, `user_${action}`, {
      followerId,
      followeeId,
    });
    await this.broadcastSocialContentInvalidated();
  }

  async broadcastNotification(notification: any): Promise<void> {
    const safeNotification = projectNotification(notification);
    if (!safeNotification) return;
    const subscribers = [
      ...(this.connectedClients.get(safeNotification.recipientId) ?? []),
    ].filter((subscriber) =>
      subscriber.subscriptions.has(
        `notifications:${safeNotification.recipientId}`
      )
    );
    for (const subscriber of subscribers) {
      try {
        const user = this.socketSessionAuth.getUser(subscriber.client);
        const selected = await this.notificationRecipients.assertSelected(
          user,
          safeNotification.recipientId
        );
        if (
          selected !== safeNotification.recipientId ||
          !(await this.isCurrentSocketSession(subscriber))
        )
          continue;
        subscriber.client.emit('notification', safeNotification);
      } catch {
        subscriber.subscriptions.delete(
          `notifications:${safeNotification.recipientId}`
        );
      }
    }
  }

  handleBroadcastNotification(payload: { notification: any }): Promise<void> {
    return this.broadcastNotification(payload.notification);
  }

  private registerClient(
    profileId: string,
    client: Socket,
    userId: string
  ): ConnectedClient {
    if (client.data?.deletionPurged)
      throw new Error('Socket session unavailable');
    const connectedClient = this.clientToConnectedClient(client) ?? {
      id: profileId,
      userId,
      client,
      subscriptions: new Set<string>(),
      contentRevision: 0,
    };
    if (!this.connectedClients.has(profileId))
      this.connectedClients.set(profileId, new Set());
    this.connectedClients.get(profileId)!.add(connectedClient);
    this.clientToProfileMap.set(client, profileId);
    return connectedClient;
  }

  private clientToConnectedClient(client: Socket): ConnectedClient | undefined {
    const profileId = this.clientToProfileMap.get(client);
    return profileId
      ? Array.from(this.connectedClients.get(profileId) ?? []).find(
          (entry) => entry.client === client
        )
      : undefined;
  }

  private advanceRealtimeFeedRevision(): void {
    for (const clients of this.connectedClients.values()) {
      for (const connected of clients) {
        connected.contentRevision++;
      }
    }
  }

  private async assertProfileAfterAuthentication(
    client: Socket,
    requestedProfileId?: string
  ): Promise<SocketSessionUser> {
    const initialAuthentication = this.authenticationReady.get(client);
    if (initialAuthentication) {
      await initialAuthentication;
      if (this.authenticationReady.get(client) !== initialAuthentication) {
        throw new Error('Socket disconnected before authentication completed');
      }
    }
    try {
      await this.socketSessionAuth.authenticate(client, true);
    } catch (error) {
      this.disconnectClient(client);
      throw error;
    }
    return this.socketSessionAuth.assertProfile(client, requestedProfileId);
  }

  private disconnectClient(client: Socket): void {
    this.authenticationReady.delete(client);
    this.removeClient(client);
    client.disconnect?.(true);
  }

  private async isCurrentSocketSession(
    connected: ConnectedClient
  ): Promise<boolean> {
    try {
      const user = await this.socketSessionAuth.authenticate(connected.client);
      if (user.userId === connected.userId && user.profileId === connected.id) {
        return true;
      }
    } catch {
      // Revoked, expired, or app-incompatible sessions lose their socket.
    }
    this.disconnectClient(connected.client);
    return false;
  }

  private async isCurrentSocketSessionForClient(
    client: Socket
  ): Promise<boolean> {
    const connected = this.clientToConnectedClient(client);
    if (connected) return this.isCurrentSocketSession(connected);
    try {
      await this.socketSessionAuth.authenticate(client);
      return true;
    } catch {
      this.disconnectClient(client);
      return false;
    }
  }

  private async broadcastToSubscribers(
    subscription: string,
    event: string,
    data: any
  ): Promise<void> {
    let subscriberCount = 0;
    const recipients = Array.from(this.connectedClients.values())
      .flatMap((clients) => Array.from(clients))
      .filter((connectedClient) =>
        connectedClient.subscriptions.has(subscription)
      );
    await Promise.all(
      recipients.map(async (connectedClient) => {
        if (!(await this.isCurrentSocketSession(connectedClient))) return;
        connectedClient.client.emit(event, data);
        subscriberCount++;
      })
    );

    this.l.debug(
      `Broadcasted ${event} to ${subscriberCount} subscribers of ${subscription}`
    );
  }
}
