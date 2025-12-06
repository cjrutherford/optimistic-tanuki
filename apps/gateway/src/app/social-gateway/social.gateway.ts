import { Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { 
  ConnectedSocket, 
  MessageBody, 
  SubscribeMessage, 
  WebSocketGateway, 
  WebSocketServer 
} from '@nestjs/websockets';
import { 
  ServiceTokens, 
  SocialRealtimeCommands,
  PostCommands,
  CommentCommands,
  VoteCommands,
  FollowCommands
} from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';
import { Server, Socket } from 'socket.io';

interface ConnectedClient {
  id: string;
  client: Socket;
  subscriptions: Set<string>;
}

@WebSocketGateway((Number(process.env.SOCIAL_SOCKET_PORT) || 3301), { 
  namespace: 'social', 
  cors: { 
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  } 
})
export class SocialGateway {
  @WebSocketServer()
  server: Server;

  private connectedClients: Map<string, ConnectedClient> = new Map();
  private clientToProfileMap: Map<Socket, string> = new Map();

  constructor(
    private readonly l: Logger,
    @Inject(ServiceTokens.SOCIAL_SERVICE) 
    private readonly socialClient: ClientProxy,
  ) {}

  @SubscribeMessage(SocialRealtimeCommands.GET_FEED)
  async handleGetFeed(
    @MessageBody() payload: { profileId: string; limit?: number; offset?: number },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    this.l.log(`Getting feed for profile: ${payload.profileId}`);
    
    // Register client if not already registered
    this.registerClient(payload.profileId, client);

    try {
      // Fetch the feed from social service
      const posts = await firstValueFrom(
        this.socialClient.send(
          { cmd: PostCommands.FIND_MANY },
          { 
            criteria: {}, 
            opts: { 
              limit: payload.limit || 50, 
              offset: payload.offset || 0,
              orderBy: 'createdAt',
              orderDirection: 'DESC'
            } 
          }
        )
      );
      
      client.emit('feed', posts || []);
    } catch (error) {
      this.l.error(`Error fetching feed: ${error.message}`);
      client.emit('error', { message: 'Failed to fetch feed' });
    }
  }

  @SubscribeMessage(SocialRealtimeCommands.SUBSCRIBE_POSTS)
  async handleSubscribePosts(
    @MessageBody() payload: { profileId: string; postIds?: string[] },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    this.l.log(`User ${payload.profileId} subscribing to posts`);
    
    const connectedClient = this.registerClient(payload.profileId, client);
    
    if (payload.postIds && payload.postIds.length > 0) {
      payload.postIds.forEach(postId => {
        connectedClient.subscriptions.add(`post:${postId}`);
      });
    } else {
      connectedClient.subscriptions.add('posts:all');
    }
    
    client.emit('subscribed', { 
      type: 'posts', 
      postIds: payload.postIds || ['all'] 
    });
  }

  @SubscribeMessage(SocialRealtimeCommands.UNSUBSCRIBE_POSTS)
  async handleUnsubscribePosts(
    @MessageBody() payload: { profileId: string; postIds?: string[] },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    this.l.log(`User ${payload.profileId} unsubscribing from posts`);
    
    const connectedClient = this.connectedClients.get(payload.profileId);
    if (!connectedClient) {
      return;
    }
    
    if (payload.postIds && payload.postIds.length > 0) {
      payload.postIds.forEach(postId => {
        connectedClient.subscriptions.delete(`post:${postId}`);
      });
    } else {
      connectedClient.subscriptions.delete('posts:all');
    }
    
    client.emit('unsubscribed', { 
      type: 'posts', 
      postIds: payload.postIds || ['all'] 
    });
  }

  @SubscribeMessage(SocialRealtimeCommands.SUBSCRIBE_USER_ACTIVITY)
  async handleSubscribeUserActivity(
    @MessageBody() payload: { profileId: string; targetUserIds?: string[] },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    this.l.log(`User ${payload.profileId} subscribing to user activity`);
    
    const connectedClient = this.registerClient(payload.profileId, client);
    
    if (payload.targetUserIds && payload.targetUserIds.length > 0) {
      payload.targetUserIds.forEach(userId => {
        connectedClient.subscriptions.add(`user:${userId}`);
      });
    } else {
      connectedClient.subscriptions.add(`user:${payload.profileId}`);
    }
    
    client.emit('subscribed', { 
      type: 'user_activity', 
      userIds: payload.targetUserIds || [payload.profileId] 
    });
  }

  @SubscribeMessage(SocialRealtimeCommands.UNSUBSCRIBE_USER_ACTIVITY)
  async handleUnsubscribeUserActivity(
    @MessageBody() payload: { profileId: string; targetUserIds?: string[] },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    this.l.log(`User ${payload.profileId} unsubscribing from user activity`);
    
    const connectedClient = this.connectedClients.get(payload.profileId);
    if (!connectedClient) {
      return;
    }
    
    if (payload.targetUserIds && payload.targetUserIds.length > 0) {
      payload.targetUserIds.forEach(userId => {
        connectedClient.subscriptions.delete(`user:${userId}`);
      });
    } else {
      connectedClient.subscriptions.delete(`user:${payload.profileId}`);
    }
    
    client.emit('unsubscribed', { 
      type: 'user_activity', 
      userIds: payload.targetUserIds || [payload.profileId] 
    });
  }

  @SubscribeMessage('disconnect')
  handleDisconnect(@ConnectedSocket() client: Socket): void {
    // Use reverse mapping for efficient lookup
    const profileId = this.clientToProfileMap.get(client);
    
    if (profileId) {
      this.l.log(`Client disconnected: ${profileId}`);
      this.connectedClients.delete(profileId);
      this.clientToProfileMap.delete(client);
    }
  }

  // Helper methods for broadcasting updates
  broadcastPostCreated(post: any): void {
    this.l.log(`Broadcasting post created: ${post.id}`);
    this.broadcastToSubscribers('posts:all', 'post_created', post);
  }

  broadcastPostUpdated(post: any): void {
    this.l.log(`Broadcasting post updated: ${post.id}`);
    this.broadcastToSubscribers(`post:${post.id}`, 'post_updated', post);
    this.broadcastToSubscribers('posts:all', 'post_updated', post);
  }

  broadcastPostDeleted(postId: string): void {
    this.l.log(`Broadcasting post deleted: ${postId}`);
    this.broadcastToSubscribers(`post:${postId}`, 'post_deleted', { postId });
    this.broadcastToSubscribers('posts:all', 'post_deleted', { postId });
  }

  broadcastCommentCreated(comment: any): void {
    this.l.log(`Broadcasting comment created on post: ${comment.postId}`);
    this.broadcastToSubscribers(`post:${comment.postId}`, 'comment_created', comment);
  }

  broadcastCommentUpdated(comment: any): void {
    this.l.log(`Broadcasting comment updated: ${comment.id}`);
    this.broadcastToSubscribers(`post:${comment.postId}`, 'comment_updated', comment);
  }

  broadcastCommentDeleted(commentId: string, postId: string): void {
    this.l.log(`Broadcasting comment deleted: ${commentId}`);
    this.broadcastToSubscribers(`post:${postId}`, 'comment_deleted', { commentId, postId });
  }

  broadcastVoteUpdated(vote: any): void {
    this.l.log(`Broadcasting vote updated on post: ${vote.postId}`);
    this.broadcastToSubscribers(`post:${vote.postId}`, 'vote_updated', vote);
  }

  broadcastFollowEvent(followerId: string, followeeId: string, action: 'follow' | 'unfollow'): void {
    this.l.log(`Broadcasting ${action} event: ${followerId} -> ${followeeId}`);
    this.broadcastToSubscribers(`user:${followeeId}`, `user_${action}`, { followerId, followeeId });
    this.broadcastToSubscribers(`user:${followerId}`, `user_${action}`, { followerId, followeeId });
  }

  private registerClient(profileId: string, client: Socket): ConnectedClient {
    // Check if this profile is already connected with a different client
    const existingClient = this.connectedClients.get(profileId);
    if (existingClient && existingClient.client !== client) {
      // Remove old client mapping
      this.clientToProfileMap.delete(existingClient.client);
      this.l.log(`Replacing existing connection for profile: ${profileId}`);
    }
    
    // Register or update the client
    const connectedClient: ConnectedClient = {
      id: profileId,
      client,
      subscriptions: existingClient?.subscriptions || new Set<string>()
    };
    
    this.connectedClients.set(profileId, connectedClient);
    this.clientToProfileMap.set(client, profileId);
    
    if (!existingClient) {
      this.l.log(`Client registered: ${profileId}`);
    }
    
    return connectedClient;
  }

  private broadcastToSubscribers(subscription: string, event: string, data: any): void {
    let subscriberCount = 0;
    
    for (const [profileId, connectedClient] of this.connectedClients.entries()) {
      if (connectedClient.subscriptions.has(subscription)) {
        connectedClient.client.emit(event, data);
        subscriberCount++;
      }
    }
    
    this.l.debug(`Broadcasted ${event} to ${subscriberCount} subscribers of ${subscription}`);
  }
}
