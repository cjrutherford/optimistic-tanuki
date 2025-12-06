# Social WebSocket Client Guide

This guide explains how to connect to and use the Social WebSocket Gateway for real-time updates on posts, comments, votes, and follows.

## Connection

The Social WebSocket Gateway runs on a separate port (default: 3301) and uses the `/social` namespace.

### Basic Connection (Socket.IO Client)

```typescript
import { io, Socket } from 'socket.io-client';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3301';

const socket: Socket = io(`${GATEWAY_URL}/social`, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
});

socket.on('connect', () => {
  console.log('Connected to Social WebSocket Gateway');
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected from Social WebSocket Gateway:', reason);
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});
```

## Subscribing to Events

### Subscribe to All Posts

```typescript
socket.emit('SUBSCRIBE_POSTS', {
  profileId: 'user-123',
});

socket.on('subscribed', (data) => {
  console.log('Subscribed to:', data);
  // { type: 'posts', postIds: ['all'] }
});
```

### Subscribe to Specific Posts

```typescript
socket.emit('SUBSCRIBE_POSTS', {
  profileId: 'user-123',
  postIds: ['post-1', 'post-2', 'post-3'],
});
```

### Subscribe to User Activity

```typescript
// Subscribe to your own activity
socket.emit('SUBSCRIBE_USER_ACTIVITY', {
  profileId: 'user-123',
});

// Subscribe to specific users' activity
socket.emit('SUBSCRIBE_USER_ACTIVITY', {
  profileId: 'user-123',
  targetUserIds: ['user-456', 'user-789'],
});
```

## Receiving Real-Time Updates

### Post Events

```typescript
// New post created
socket.on('post_created', (post) => {
  console.log('New post:', post);
  // Update your UI to show the new post
});

// Post updated
socket.on('post_updated', (post) => {
  console.log('Post updated:', post);
  // Update the post in your UI
});

// Post deleted
socket.on('post_deleted', (data) => {
  console.log('Post deleted:', data.postId);
  // Remove the post from your UI
});
```

### Comment Events

```typescript
// New comment on a post
socket.on('comment_created', (comment) => {
  console.log('New comment:', comment);
  // Add comment to the post's comment list
});

// Comment updated
socket.on('comment_updated', (comment) => {
  console.log('Comment updated:', comment);
  // Update the comment in your UI
});

// Comment deleted
socket.on('comment_deleted', (data) => {
  console.log('Comment deleted:', data.commentId, 'from post:', data.postId);
  // Remove the comment from your UI
});
```

### Vote Events

```typescript
// Vote added or updated on a post
socket.on('vote_updated', (vote) => {
  console.log('Vote updated:', vote);
  // Update vote count display
});
```

### Follow Events

```typescript
// User followed
socket.on('user_follow', (data) => {
  console.log('Follow event:', data.followerId, '->', data.followeeId);
  // Update follower count
});

// User unfollowed
socket.on('user_unfollow', (data) => {
  console.log('Unfollow event:', data.followerId, '->', data.followeeId);
  // Update follower count
});
```

## Getting Feed

```typescript
socket.emit('GET_FEED', {
  profileId: 'user-123',
  limit: 50,
  offset: 0,
});

socket.on('feed', (posts) => {
  console.log('Received feed:', posts);
  // Display feed in your UI
});

socket.on('error', (error) => {
  console.error('Error fetching feed:', error);
});
```

## Unsubscribing

### Unsubscribe from Posts

```typescript
// Unsubscribe from all posts
socket.emit('UNSUBSCRIBE_POSTS', {
  profileId: 'user-123',
});

// Unsubscribe from specific posts
socket.emit('UNSUBSCRIBE_POSTS', {
  profileId: 'user-123',
  postIds: ['post-1', 'post-2'],
});
```

### Unsubscribe from User Activity

```typescript
socket.emit('UNSUBSCRIBE_USER_ACTIVITY', {
  profileId: 'user-123',
  targetUserIds: ['user-456'],
});
```

## Complete Angular Service Example

```typescript
import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable } from 'rxjs';
import { Post, Comment, Vote } from '@optimistic-tanuki/models';

@Injectable({
  providedIn: 'root'
})
export class SocialWebSocketService implements OnDestroy {
  private socket: Socket;
  private connected$ = new BehaviorSubject<boolean>(false);
  private posts$ = new BehaviorSubject<Post[]>([]);
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 1000;

  constructor() {
    this.initializeSocket();
  }

  private initializeSocket(): void {
    const gatewayUrl = 'http://localhost:3301'; // Configure via environment

    this.socket = io(`${gatewayUrl}/social`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: this.baseReconnectDelay,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    this.socket.on('connect', () => {
      console.log('Connected to Social WebSocket');
      this.connected$.next(true);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      this.connected$.next(false);
      
      if (reason === 'io server disconnect') {
        // Manual reconnection with exponential backoff
        this.reconnectWithBackoff();
      }
    });

    this.socket.on('post_created', (post: Post) => {
      const currentPosts = this.posts$.value;
      this.posts$.next([post, ...currentPosts]);
    });

    this.socket.on('post_updated', (post: Post) => {
      const currentPosts = this.posts$.value;
      const index = currentPosts.findIndex(p => p.id === post.id);
      if (index !== -1) {
        currentPosts[index] = post;
        this.posts$.next([...currentPosts]);
      }
    });

    this.socket.on('post_deleted', (data: { postId: string }) => {
      const currentPosts = this.posts$.value;
      this.posts$.next(currentPosts.filter(p => p.id !== data.postId));
    });

    // Add more event listeners as needed
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
      this.socket.connect();
    }, delay);
  }

  subscribeToPosts(profileId: string, postIds?: string[]): void {
    this.socket.emit('SUBSCRIBE_POSTS', { profileId, postIds });
  }

  subscribeToUserActivity(profileId: string, targetUserIds?: string[]): void {
    this.socket.emit('SUBSCRIBE_USER_ACTIVITY', { profileId, targetUserIds });
  }

  getFeed(profileId: string, limit = 50, offset = 0): void {
    this.socket.emit('GET_FEED', { profileId, limit, offset });
  }

  getConnectionStatus(): Observable<boolean> {
    return this.connected$.asObservable();
  }

  getPosts(): Observable<Post[]> {
    return this.posts$.asObservable();
  }

  ngOnDestroy(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
```

## Environment Configuration

Add to your environment configuration:

```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000',
  socialWebSocketUrl: 'http://localhost:3301',
};
```

## Connection Options

### Exponential Backoff Reconnection

The client should implement exponential backoff for reconnection attempts to prevent overwhelming the server:

```typescript
const reconnectionConfig = {
  reconnection: true,
  reconnectionDelay: 1000,        // Initial delay: 1 second
  reconnectionDelayMax: 5000,     // Max delay: 5 seconds
  reconnectionAttempts: 5,        // Max attempts before giving up
};
```

### Manual Reconnection Strategy

For more control over reconnection:

```typescript
let reconnectAttempts = 0;
const maxAttempts = 5;
const baseDelay = 1000;

function reconnectWithExponentialBackoff() {
  if (reconnectAttempts >= maxAttempts) {
    console.error('Failed to reconnect after maximum attempts');
    return;
  }

  const delay = baseDelay * Math.pow(2, reconnectAttempts);
  reconnectAttempts++;

  setTimeout(() => {
    console.log(`Reconnecting... (attempt ${reconnectAttempts}/${maxAttempts})`);
    socket.connect();
  }, delay);
}

socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect') {
    reconnectWithExponentialBackoff();
  }
});

socket.on('connect', () => {
  reconnectAttempts = 0; // Reset on successful connection
});
```

## Error Handling

```typescript
socket.on('error', (error) => {
  console.error('Socket error:', error);
  // Show error notification to user
  // Implement retry logic if needed
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  // Handle connection failures
});
```

## Best Practices

1. **Connection Management**
   - Initialize connection when user logs in
   - Disconnect when user logs out or navigates away
   - Implement exponential backoff for reconnection

2. **Subscription Management**
   - Subscribe to events when component mounts
   - Unsubscribe when component unmounts
   - Keep track of active subscriptions

3. **Performance**
   - Don't subscribe to more than necessary
   - Unsubscribe from posts when no longer viewing them
   - Use pagination for feed requests

4. **Error Handling**
   - Handle connection errors gracefully
   - Show user-friendly messages
   - Implement retry logic with backoff

5. **State Management**
   - Use a central state management solution (NgRx, Redux, etc.)
   - Update state based on real-time events
   - Ensure UI consistency with optimistic updates

## Security Considerations

- Always validate incoming data
- Implement authentication/authorization (currently not enforced at socket level)
- Use HTTPS/WSS in production
- Validate user permissions before showing sensitive data
- Sanitize all user-generated content before displaying

## Testing

Example test for the WebSocket service:

```typescript
import { TestBed } from '@angular/core/testing';
import { SocialWebSocketService } from './social-websocket.service';

describe('SocialWebSocketService', () => {
  let service: SocialWebSocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SocialWebSocketService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should emit connection status', (done) => {
    service.getConnectionStatus().subscribe(status => {
      expect(typeof status).toBe('boolean');
      done();
    });
  });
});
```

## Troubleshooting

### Connection Issues

1. **Cannot connect**: Check that the gateway is running and the port is correct
2. **Frequent disconnections**: Check network stability and server resources
3. **No events received**: Verify subscriptions are active and correct

### Common Error Messages

- `ERR_CONNECTION_REFUSED`: Gateway is not running
- `ERR_TIMEOUT`: Network issues or server overload
- `Transport unknown`: Incorrect transport configuration

## Next Steps

- Implement authentication at the WebSocket level
- Add rate limiting for subscriptions
- Implement message queuing for offline clients
- Add compression for large payloads
- Implement room-based subscriptions for better scalability
