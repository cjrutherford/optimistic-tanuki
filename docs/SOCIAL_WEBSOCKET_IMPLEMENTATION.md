# Social WebSocket Implementation Summary

## Overview

This document summarizes the implementation of WebSocket support for the social service, enabling real-time updates for posts, comments, votes, and follows.

## Architecture

### Components

1. **Social Gateway** (`apps/gateway/src/app/social-gateway/social.gateway.ts`)
   - WebSocket server running on port 3301
   - Uses Socket.IO with namespace `/social`
   - Manages client connections and subscriptions
   - Broadcasts events to subscribed clients

2. **Controller Integration**
   - `SocialController` - Broadcasts post, comment, and vote events
   - `FollowController` - Broadcasts follow/unfollow events

3. **Constants** (`libs/constants/src/lib/libs/social.ts`)
   - `SocialRealtimeCommands` - WebSocket command definitions

### Flow Diagram

```
Client → WebSocket (port 3301) → Social Gateway → Social Service (microservice)
                                        ↓
                                   Controllers
                                        ↓
                              Broadcast to Clients
```

## Implementation Details

### Gateway Features

**Connection Management:**
- Bidirectional client mapping for O(1) lookups
- Handles client reconnections gracefully
- Cleans up stale connections automatically

**Subscription System:**
- Subscribe to all posts: `SUBSCRIBE_POSTS` (no postIds)
- Subscribe to specific posts: `SUBSCRIBE_POSTS` (with postIds array)
- Subscribe to user activity: `SUBSCRIBE_USER_ACTIVITY`
- Unsubscribe options for all subscription types

**Broadcasting:**
- Only sends events to subscribed clients
- Supports multiple subscription types per client
- Efficient event filtering based on subscriptions

### Events

**Outbound (Server → Client):**
- `post_created` - New post created
- `post_updated` - Post updated
- `post_deleted` - Post deleted
- `comment_created` - New comment on post
- `comment_updated` - Comment updated
- `comment_deleted` - Comment deleted
- `vote_updated` - Vote added/updated
- `user_follow` - User followed
- `user_unfollow` - User unfollowed
- `feed` - Feed data response
- `subscribed` - Subscription confirmation
- `unsubscribed` - Unsubscription confirmation
- `error` - Error occurred

**Inbound (Client → Server):**
- `SUBSCRIBE_POSTS` - Subscribe to post updates
- `UNSUBSCRIBE_POSTS` - Unsubscribe from posts
- `SUBSCRIBE_USER_ACTIVITY` - Subscribe to user activity
- `UNSUBSCRIBE_USER_ACTIVITY` - Unsubscribe from user activity
- `GET_FEED` - Fetch user feed
- `disconnect` - Client disconnecting

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SOCIAL_SOCKET_PORT` | 3301 | Port for social WebSocket server |
| `CORS_ORIGIN` | '*' | CORS origin configuration |

### Docker Configuration

```yaml
gateway:
  ports:
    - '3000:3000'   # HTTP API
    - '3300:3300'   # Chat WebSocket
    - '3301:3301'   # Social WebSocket
```

## Security

### CORS Configuration

- Configurable via `CORS_ORIGIN` environment variable
- Defaults to `*` for development
- Should be set to specific origins in production

### Authentication

- Currently no authentication at WebSocket level
- Controllers use `AuthGuard` for REST API calls
- Future enhancement: Add WebSocket authentication middleware

## Performance Optimizations

1. **O(1) Client Lookups**
   - Uses `clientToProfileMap` for efficient disconnect handling
   - Avoids linear searches through connected clients

2. **Subscription-Based Broadcasting**
   - Only sends events to interested clients
   - Reduces unnecessary network traffic

3. **Optional postId Parameter**
   - `DELETE /comment/:id?postId=xxx` avoids extra API call
   - Improves performance for comment deletion

## Error Handling

### Gateway
- Type-safe error handling with instanceof checks
- Sanitized error messages sent to clients
- Full error logging on server side

### Controllers
- Optional gateway injection (won't break if gateway unavailable)
- Graceful degradation if WebSocket not available
- Error logging with safe message extraction

## Testing

### Unit Tests

Located in `apps/gateway/src/app/social-gateway/social.gateway.spec.ts`:
- Connection handling
- Subscription management
- Feed retrieval
- Disconnect scenarios

### Manual Testing

Use Socket.IO client to test:

```javascript
const socket = io('http://localhost:3301/social');

socket.on('connect', () => {
  console.log('Connected');
  socket.emit('SUBSCRIBE_POSTS', { profileId: 'user123' });
});

socket.on('post_created', (post) => {
  console.log('New post:', post);
});
```

## Monitoring & Debugging

### Logging

The gateway logs:
- Client connections/disconnections
- Subscription changes
- Broadcast events
- Errors with context

### Metrics to Monitor

- Connected clients count
- Subscriptions per client
- Broadcast event frequency
- Error rates

## Known Limitations

1. **No Authentication**
   - WebSocket connections not authenticated
   - Future enhancement required

2. **No Rate Limiting**
   - Clients can subscribe/unsubscribe without limits
   - Consider adding rate limiting in production

3. **No Persistence**
   - Client state not persisted
   - Clients must re-subscribe after reconnection

4. **Single Instance**
   - No horizontal scaling support yet
   - Consider Redis adapter for multi-instance deployments

## Future Enhancements

### Short Term
- [ ] Add WebSocket authentication
- [ ] Implement rate limiting
- [ ] Add connection pooling

### Long Term
- [ ] Redis adapter for horizontal scaling
- [ ] Message queuing for offline clients
- [ ] Compression for large payloads
- [ ] Room-based subscriptions
- [ ] Presence system (online/offline status)

## Maintenance

### Updating Events

To add a new event type:

1. Add command to `SocialRealtimeCommands` in `libs/constants/src/lib/libs/social.ts`
2. Add handler in `social.gateway.ts`
3. Add broadcast method in gateway
4. Call broadcast method from controller
5. Update documentation

### Debugging Tips

1. **Client not receiving events:**
   - Check if client is subscribed
   - Verify subscription type matches broadcast
   - Check network connectivity

2. **Gateway not starting:**
   - Check port availability (3301)
   - Verify environment variables
   - Check logs for errors

3. **Performance issues:**
   - Monitor connected client count
   - Check subscription distribution
   - Review broadcast frequency

## References

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [NestJS WebSocket Gateway](https://docs.nestjs.com/websockets/gateways)
- [Client Implementation Guide](./SOCIAL_WEBSOCKET_CLIENT.md)
- [Gateway README](../apps/gateway/README.md)

## Support

For questions or issues:
1. Check the client implementation guide
2. Review the gateway logs
3. Check Socket.IO connection status
4. Verify environment configuration

## MVP Compliance

This implementation fully satisfies MVP requirements:
- ✅ Real-time client with exponential reconnect/backoff (MVP.md line 89)
- ✅ SSE/WebSocket client helper with backoff (MVP.md line 99)

## Changelog

### Version 1.0.0 (Initial Release)
- Social gateway implementation
- Subscription-based broadcasting
- Post, comment, vote, and follow events
- Client documentation
- Docker configuration
- Security and performance optimizations
