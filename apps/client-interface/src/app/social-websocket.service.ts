import { Injectable, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable } from 'rxjs';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import {
  PostDto,
  CommentDto,
  VoteDto,
  FollowEventDto,
} from '@optimistic-tanuki/ui-models';
import { AuthStateService } from './state/auth-state.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class SocialWebSocketService implements OnDestroy {
  private socket: Socket | null = null;
  private connected$ = new BehaviorSubject<boolean>(false);
  private posts$ = new BehaviorSubject<PostDto[]>([]);
  private connectionError$ = new BehaviorSubject<string | null>(null);
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 1000;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private apiBaseUrl = inject(API_BASE_URL);
  private authStateService = inject(AuthStateService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  constructor() {
    // Service initializes on demand via connect()
  }

  /**
   * Initialize and connect to the Social WebSocket server
   */
  connect(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (this.socket?.connected) {
      console.log('Already connected to Social WebSocket');
      return;
    }

    // Parse the API base URL to get the WebSocket URL
    // Assuming API_BASE_URL is like "http://localhost:3000/api" or "/api"
    // We need to connect to the WebSocket on a different port (3301)
    let url: URL;
    try {
      url = new URL(this.apiBaseUrl);
    } catch (e) {
      // If apiBaseUrl is relative, use window.location.origin
      url = new URL(this.apiBaseUrl, window.location.origin);
    }
    const wsUrl = `${url.protocol}//${url.hostname}:3301`;

    console.log('Connecting to Social WebSocket at:', wsUrl);

    const token = this.authStateService.getToken();
    this.socket = io(`${wsUrl}/social`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: this.baseReconnectDelay,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
      auth: token ? { token } : undefined,
      extraHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
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
      this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from Social WebSocket:', reason);
      this.connected$.next(false);

      if (reason !== 'io client disconnect') {
        // Trigger backoff for unexpected disconnections
        this.reconnectWithBackoff();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.connectionError$.next('Connection error ' + error.message);

      // Check if this is an authentication error
      if (
        error.message.includes('unauthorized') ||
        error.message.includes('jwt') ||
        error.message.includes('token') ||
        error.message.includes('Unauthorized')
      ) {
        console.error(
          'Social WebSocket authentication failed - redirecting to login'
        );
        this.authStateService.logout();
        this.router.navigate(['/login']);
      } else {
        this.reconnectWithBackoff();
      }
    });

    this.socket.on('connect_timeout', () => {
      console.warn('Connection timed out');
      this.connectionError$.next('Connection timed out');
      this.reconnectWithBackoff();
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Reconnection failed');
      this.reconnectWithBackoff();
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);

      // Handle authorization errors from the server
      if (typeof error === 'object' && error !== null) {
        const errorObj = error as any;
        if (
          errorObj.type === 'UnauthorizedException' ||
          errorObj.message?.includes('Unauthorized') ||
          errorObj.statusCode === 401
        ) {
          console.error(
            'Social WebSocket authorization error - redirecting to login'
          );
          this.authStateService.logout();
          this.router.navigate(['/login']);
          return;
        }
      }

      this.reconnectWithBackoff(); // Handle unexpected errors with backoff
    });
    // Post events
    this.socket.on('post_created', (post: PostDto) => {
      console.log('Post created:', post);
      const currentPosts = this.posts$.value;
      if (!currentPosts.some((p) => p.id === post.id)) {
        this.posts$.next([post, ...currentPosts]);
      }
    });

    this.socket.on('post_updated', (post: PostDto) => {
      console.log('Post updated:', post);
      const currentPosts = this.posts$.value;
      const index = currentPosts.findIndex((p) => p.id === post.id);
      if (index !== -1) {
        currentPosts[index] = post;
        this.posts$.next([...currentPosts]);
      }
    });

    this.socket.on('post_deleted', (data: { postId: string }) => {
      console.log('Post deleted:', data.postId);
      const currentPosts = this.posts$.value;
      this.posts$.next(currentPosts.filter((p) => p.id !== data.postId));
    });

    // Comment events
    this.socket.on('comment_created', (comment: CommentDto) => {
      console.log('Comment created:', comment);
    });

    this.socket.on('comment_updated', (comment: CommentDto) => {
      console.log('Comment updated:', comment);
    });

    this.socket.on(
      'comment_deleted',
      (data: { commentId: string; postId: string }) => {
        console.log('Comment deleted:', data);
      }
    );

    // Vote events
    this.socket.on('vote_updated', (vote: VoteDto) => {
      console.log('Vote updated:', vote);
    });

    // Follow events
    this.socket.on('user_follow', (data: FollowEventDto) => {
      console.log('User followed:', data);
    });

    this.socket.on('user_unfollow', (data: FollowEventDto) => {
      console.log('User unfollowed:', data);
    });

    // Feed response
    this.socket.on('feed', (posts: PostDto[]) => {
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
      this.connectionError$.next(
        'Unable to reconnect after multiple attempts.'
      );
      return;
    }

    const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(
      `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimeoutId = setTimeout(() => {
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
  unsubscribeFromUserActivity(
    profileId: string,
    targetUserIds?: string[]
  ): void {
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

  getConnectionError(): Observable<string | null> {
    return this.connectionError$.asObservable();
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
  getPosts(): Observable<PostDto[]> {
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

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
  }
}
