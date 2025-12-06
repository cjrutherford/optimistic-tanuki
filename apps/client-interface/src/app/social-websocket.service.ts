import { Injectable, OnDestroy, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable } from 'rxjs';
import { API_BASE_URL } from '@optimistic-tanuki/constants';

export interface Post {
  id: string;
  content: string;
  userId: string;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any;
}

export interface Comment {
  id: string;
  postId: string;
  content: string;
  userId: string;
  [key: string]: any;
}

export interface Vote {
  id: string;
  postId: string;
  value: number;
  userId: string;
  [key: string]: any;
}

export interface FollowEvent {
  followerId: string;
  followeeId: string;
}

@Injectable({
  providedIn: 'root'
})
export class SocialWebSocketService implements OnDestroy {
  private socket: Socket | null = null;
  private connected$ = new BehaviorSubject<boolean>(false);
  private posts$ = new BehaviorSubject<Post[]>([]);
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 1000;
  private apiBaseUrl = inject(API_BASE_URL);

  constructor() {
    // Service initializes on demand via connect()
  }

  /**
   * Initialize and connect to the Social WebSocket server
   */
  connect(): void {
    if (this.socket?.connected) {
      console.log('Already connected to Social WebSocket');
      return;
    }

    // Parse the API base URL to get the WebSocket URL
    // Assuming API_BASE_URL is like "http://localhost:3000/api"
    // We need to connect to the WebSocket on a different port (3301)
    const url = new URL(this.apiBaseUrl);
    const wsUrl = `${url.protocol}//${url.hostname}:3301`;

    console.log('Connecting to Social WebSocket at:', wsUrl);

    this.socket = io(`${wsUrl}/social`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: this.baseReconnectDelay,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupSocketListeners();
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected$.next(false);
    }
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Connected to Social WebSocket');
      this.connected$.next(true);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from Social WebSocket:', reason);
      this.connected$.next(false);

      if (reason === 'io server disconnect') {
        // Manual reconnection with exponential backoff
        this.reconnectWithBackoff();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Post events
    this.socket.on('post_created', (post: Post) => {
      console.log('Post created:', post);
      const currentPosts = this.posts$.value;
      this.posts$.next([post, ...currentPosts]);
    });

    this.socket.on('post_updated', (post: Post) => {
      console.log('Post updated:', post);
      const currentPosts = this.posts$.value;
      const index = currentPosts.findIndex(p => p.id === post.id);
      if (index !== -1) {
        currentPosts[index] = post;
        this.posts$.next([...currentPosts]);
      }
    });

    this.socket.on('post_deleted', (data: { postId: string }) => {
      console.log('Post deleted:', data.postId);
      const currentPosts = this.posts$.value;
      this.posts$.next(currentPosts.filter(p => p.id !== data.postId));
    });

    // Comment events
    this.socket.on('comment_created', (comment: Comment) => {
      console.log('Comment created:', comment);
    });

    this.socket.on('comment_updated', (comment: Comment) => {
      console.log('Comment updated:', comment);
    });

    this.socket.on('comment_deleted', (data: { commentId: string; postId: string }) => {
      console.log('Comment deleted:', data);
    });

    // Vote events
    this.socket.on('vote_updated', (vote: Vote) => {
      console.log('Vote updated:', vote);
    });

    // Follow events
    this.socket.on('user_follow', (data: FollowEvent) => {
      console.log('User followed:', data);
    });

    this.socket.on('user_unfollow', (data: FollowEvent) => {
      console.log('User unfollowed:', data);
    });

    // Feed response
    this.socket.on('feed', (posts: Post[]) => {
      console.log('Feed received:', posts);
      this.posts$.next(posts);
    });

    // Subscription confirmations
    this.socket.on('subscribed', (data: any) => {
      console.log('Subscribed:', data);
    });

    this.socket.on('unsubscribed', (data: any) => {
      console.log('Unsubscribed:', data);
    });
  }

  private reconnectWithBackoff(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.socket?.connect();
    }, delay);
  }

  /**
   * Subscribe to all posts updates
   */
  subscribeToPosts(profileId: string, postIds?: string[]): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected. Call connect() first.');
      return;
    }
    this.socket.emit('SUBSCRIBE_POSTS', { profileId, postIds });
  }

  /**
   * Unsubscribe from posts updates
   */
  unsubscribeFromPosts(profileId: string, postIds?: string[]): void {
    if (!this.socket?.connected) {
      return;
    }
    this.socket.emit('UNSUBSCRIBE_POSTS', { profileId, postIds });
  }

  /**
   * Subscribe to user activity updates
   */
  subscribeToUserActivity(profileId: string, targetUserIds?: string[]): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected. Call connect() first.');
      return;
    }
    this.socket.emit('SUBSCRIBE_USER_ACTIVITY', { profileId, targetUserIds });
  }

  /**
   * Unsubscribe from user activity updates
   */
  unsubscribeFromUserActivity(profileId: string, targetUserIds?: string[]): void {
    if (!this.socket?.connected) {
      return;
    }
    this.socket.emit('UNSUBSCRIBE_USER_ACTIVITY', { profileId, targetUserIds });
  }

  /**
   * Get the user's feed
   */
  getFeed(profileId: string, limit = 50, offset = 0): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected. Call connect() first.');
      return;
    }
    this.socket.emit('GET_FEED', { profileId, limit, offset });
  }

  /**
   * Get connection status as an Observable
   */
  getConnectionStatus(): Observable<boolean> {
    return this.connected$.asObservable();
  }

  /**
   * Get posts as an Observable
   */
  getPosts(): Observable<Post[]> {
    return this.posts$.asObservable();
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
